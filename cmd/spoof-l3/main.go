package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"os"
	"os/signal"
	"syscall"

	"github.com/ParsaKSH/spoof-tunnel/internal/l3"
)

func main() {
	path := flag.String("config", "", "JSON configuration file")
	check := flag.Bool("check", false, "validate configuration without opening sockets")
	version := flag.Bool("version", false, "print version and exit")
	flag.Parse()
	if *version {
		fmt.Println("spoof-l3 " + l3.Version)
		return
	}
	if *path == "" {
		log.Fatal("missing --config flag")
	}
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
