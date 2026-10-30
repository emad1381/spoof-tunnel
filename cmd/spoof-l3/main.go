package main

import (
	"context"
	"encoding/json"
	"flag"
	"github.com/ParsaKSH/spoof-tunnel/internal/l3"
	"log"
	"os"
	"os/signal"
	"syscall"
)

func main() {
	path := flag.String("config", "", "JSON configuration file")
	check := flag.Bool("check", false, "validate configuration without opening sockets")
	flag.Parse()
	data, err := os.ReadFile(*path)
	if err != nil {
		log.Fatal(err)
	}
	var c l3.Config
	if err = json.Unmarshal(data, &c); err != nil {
		log.Fatal(err)
	}
	if err = c.Validate(); err != nil {
		log.Fatal(err)
	}
	if *check {
		log.Print("configuration valid")
		return
	}
	ctx, cancel := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer cancel()
	if err = l3.Run(ctx, c); err != nil {
		log.Fatal(err)
	}
}
