#!/usr/bin/env python3
"""Exercise the built package's real HTTP API with an isolated database."""
import json, os, pathlib, socket, subprocess, tempfile, time, urllib.request, urllib.error
binary = str(pathlib.Path(os.environ.get("SPOOF_PANEL_BINARY", "dist/spoof-panel")).resolve())
with tempfile.TemporaryDirectory(prefix="spoof-panel-smoke-") as directory:
    env = {**os.environ, "SPOOF_DATA_DIR": directory, "SPOOF_PUBLIC_IP": "127.0.0.1"}
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0)); port = sock.getsockname()[1]
    def setup(password=None):
        args = [binary, "--setup", "--setup-user", "testadmin", "--setup-port", str(port)]
        if password: args += ["--setup-pass", password]
        return subprocess.run(args, env=env, check=True, capture_output=True, text=True).stdout
    setup("initial-test-password")
    credentials = pathlib.Path(directory, "credentials.txt").read_text()
    assert "initial-test-password" not in credentials
    prefix = next(line.split(": ", 1)[1] for line in credentials.splitlines() if line.startswith("Web Path:"))
    base = f"http://127.0.0.1:{port}{prefix}"
    process = subprocess.Popen([binary, "--bind", "127.0.0.1"], env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    token = ""
    def api(path, data=None, method=None, expected=200):
        headers = {"Content-Type": "application/json"}
        if token: headers["Authorization"] = "Bearer " + token
        request = urllib.request.Request(base + "/api" + path, data=None if data is None else json.dumps(data).encode(), headers=headers, method=method)
        try:
            with urllib.request.urlopen(request, timeout=10) as response: status, body = response.status, response.read()
        except urllib.error.HTTPError as error: status, body = error.code, error.read()
        assert status == expected, (path, status, body)
        return json.loads(body)
    try:
        for _ in range(100):
            try: api("/auth/check"); break
            except (OSError, urllib.error.URLError): time.sleep(.1)
        else: raise RuntimeError("panel did not become ready")
        api("/auth/login", {"username":"testadmin","password":"wrong-password"}, expected=401)
        token = api("/auth/login", {"username":"testadmin","password":"initial-test-password"})["token"]
        api("/dashboard"); api("/system")
        with urllib.request.urlopen(base + "/dashboard/", timeout=5) as response:
            assert b"<html" in response.read()
        with urllib.request.urlopen(f"http://127.0.0.1:{port}/favicon.ico", timeout=5) as response:
            assert response.status == 200 and response.read()
        pair = dict(engine="tun",name="smoke",local_ip="192.0.2.1",remote_ip="192.0.2.2",local_spoof="198.51.100.1",remote_spoof="198.51.100.2",listen="127.0.0.1:5000",forward="127.0.0.1:51820",upload="icmp",download="icmp",local_port=5001,remote_port=8090,save_role="local",tun_subnet="10.77.0.0/30")
        result = api("/pairs", pair); instance = result["saved"]; ident = instance["id"]
        api("/pairs", pair, expected=400)
        rule = api(f"/instances/{ident}/forwards", {"listen_port":15443,"target_port":443,"enabled":False}, expected=201)
        assert rule["enabled"] is False
        rules = api(f"/instances/{ident}/forwards"); assert rules[0]["rule"]["enabled"] is False
        api(f"/instances/{ident}/spoof-ips", {"content":"198.51.100.3"}, method="PUT")
        assert api(f"/instances/{ident}")["instance"]["spoof_ip_list"] == "198.51.100.3"
        changed = api("/settings/password", {"old_password":"initial-test-password","new_password":"updated-test-password"}, method="PUT")
        api("/auth/me", expected=401)
        token = changed["token"]; api("/auth/me")
        setup()  # Upgrade/setup preserves the updated password.
        api("/auth/login", {"username":"testadmin","password":"updated-test-password"})
        setup("reset-test-password")
        api("/auth/me", expected=401)
        token = api("/auth/login", {"username":"testadmin","password":"reset-test-password"})["token"]
        api("/auth/me")
        assert "reset-test-password" not in pathlib.Path(directory,"credentials.txt").read_text()
        print("PASS panel smoke: login, frontend, pairs, conflicts, disabled forward, IP pool, password upgrade/reset and JWT revocation")
    finally:
        process.terminate()
        try: process.wait(timeout=15)
        except subprocess.TimeoutExpired: process.kill(); process.wait()
