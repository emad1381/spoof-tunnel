//go:build !linux

package tester

import (
	"fmt"
)

func (r *Runner) doSend(cfg TesterConfig, ranges *IPRangeSet, cancel <-chan struct{}) error {
	return fmt.Errorf("raw socket spoof tester is only supported on Linux")
}

func (r *Runner) doReceive(cfg TesterConfig, ranges *IPRangeSet, cancel <-chan struct{}) error {
	return fmt.Errorf("raw socket spoof tester is only supported on Linux")
}
