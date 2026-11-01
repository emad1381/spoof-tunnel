package api

import (
	"errors"
	"fmt"
	"net"
	"net/http"
	"strconv"
	"strings"
	"unicode/utf8"

	"github.com/ParsaKSH/spoof-tunnel/panel/internal/db"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func parseUintParam(c *gin.Context, name string) (uint, error) {
	v, err := strconv.ParseUint(c.Param(name), 10, 32)
	if err != nil || v == 0 {
		return 0, fmt.Errorf("invalid %s", name)
	}
	return uint(v), nil
}

// Forward rules are the reverse-tunnel entry points (see package
// forward): a client dials Iran:LISTEN_PORT, the panel pipes it to the
// tunnel peer's TUN address on TARGET_PORT. The target IP is never
// supplied by the caller — it is always the owning instance's TunPeer —
// so a rule cannot be repurposed as a general-purpose proxy.

// GET /instances/:id/forwards
func (s *Server) handleListForwards(c *gin.Context) {
	id, err := parseID(c)
	if err != nil {
		return
	}
	statuses := s.manager.ForwardStatuses(id)
	if statuses == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "instance not found"})
		return
	}
	c.JSON(http.StatusOK, statuses)
}

type createForwardRequest struct {
	Name       string `json:"name"`
	Protocol   string `json:"protocol"`
	ListenPort int    `json:"listen_port"`
	TargetPort int    `json:"target_port"`
	Enabled    *bool  `json:"enabled"`
}

// POST /instances/:id/forwards
func (s *Server) handleCreateForward(c *gin.Context) {
	s.mutationMu.Lock()
	defer s.mutationMu.Unlock()
	id, err := parseID(c)
	if err != nil {
		return
	}
	var req createForwardRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	req.Name = strings.TrimSpace(req.Name)
	if utf8.RuneCountInString(req.Name) > 100 {
		c.JSON(400, gin.H{"error": "name must be at most 100 characters"})
		return
	}
	if req.Protocol == "" {
		req.Protocol = "tcp"
	}
	if req.Protocol != "tcp" {
		// UDP needs session tracking; it is not a TCP copy. Rejecting
		// it loudly beats silently creating a rule that cannot work.
		c.JSON(http.StatusBadRequest, gin.H{"error": "only tcp forward rules are supported in v1 (udp is not implemented)"})
		return
	}
	if req.ListenPort < 1 || req.ListenPort > 65535 || req.TargetPort < 1 || req.TargetPort > 65535 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "listen_port and target_port must be 1-65535"})
		return
	}
	var inst db.TunnelInstance
	if err := s.db.First(&inst, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "instance not found"})
		return
	}
	if inst.Engine != "tun" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "forward rules require a tun tunnel (legacy relay has its own listen/forward fields)"})
		return
	}
	if net.ParseIP(inst.TunPeer) == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "instance has no peer TUN address; start the tunnel pair first"})
		return
	}
	// A forwarder must never steal a tunnel carrier port: binding it
	// would break the tunnel itself, and the failure would look like a
	// tunnel outage. Check every tunnel on this host, not just the
	// owning one: carrier ports are usually the same defaults (5001 /
	// 8090) on all of them, but a custom-port tunnel must not be
	// shadowed either.
	var all []db.TunnelInstance
	if err := s.db.Find(&all).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	for _, tunnel := range all {
		if tunnel.RecvTransport != "tcp" {
			continue
		}
		port := tunnel.RecvPort
		if tunnel.Mode == "remote" {
			port = tunnel.ListenPort
		}
		if port == req.ListenPort {
			c.JSON(400, gin.H{"error": "listen_port collides with a local TCP carrier port"})
			return
		}
	}

	// One listen port per host: two enabled rules binding the same
	// port cannot both listen, regardless of which tunnel they belong
	// to. Disabled rules do not bind, so they must not block a new
	// enabled rule on the same port.
	enabled := req.Enabled == nil || *req.Enabled
	var clash db.ForwardRule
	err = s.db.Where("listen_port = ? AND enabled = ?", req.ListenPort, true).First(&clash).Error
	if err == nil && enabled {
		c.JSON(http.StatusBadRequest, gin.H{"error": "listen_port is already used by another forward rule"})
		return
	}
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	var port db.Setting
	if s.db.Where("key = ?", "panel_port").First(&port).Error == nil && port.Value == strconv.Itoa(req.ListenPort) {
		c.JSON(400, gin.H{"error": "listen_port collides with the panel port"})
		return
	}
	rule := db.ForwardRule{
		InstanceID: id,
		Name:       req.Name,
		Protocol:   req.Protocol,
		ListenPort: req.ListenPort,
		TargetPort: req.TargetPort,
		Enabled:    enabled,
	}
	if rule.Name == "" {
		rule.Name = "forward"
	}
	if err := s.db.Create(&rule).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	// If the tunnel is already running, start this rule now so the user
	// does not have to restart the tunnel to test it. A bind failure
	// here deletes the rule again and is reported immediately, instead
	// of leaving a silently dead rule in the list.
	if enabled {
		if status, _ := s.manager.InstanceStatus(id); status == "running" {
			if err := s.manager.StartForwarder(inst, rule); err != nil {
				s.manager.StopForwarder(id, rule.ID)
				_ = s.db.Delete(&db.ForwardRule{}, rule.ID).Error
				c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
				return
			}
		}
	}
	c.JSON(http.StatusCreated, rule)
}

// DELETE /instances/:id/forwards/:ruleID
func (s *Server) handleDeleteForward(c *gin.Context) {
	s.mutationMu.Lock()
	defer s.mutationMu.Unlock()
	id, err := parseID(c)
	if err != nil {
		return
	}
	ruleID, err := parseUintParam(c, "ruleID")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid rule id"})
		return
	}
	var rule db.ForwardRule
	if err := s.db.Where("id = ? AND instance_id = ?", ruleID, id).First(&rule).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "forward rule not found"})
		return
	}
	s.manager.StopForwarder(id, rule.ID)
	if err := s.db.Delete(&rule).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}
