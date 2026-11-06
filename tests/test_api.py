"""Testes da API da Área da dona. Rode com tests/rodar_testes.sh, nunca no site real."""
import http.cookiejar
import json
import os
import sys
import urllib.error
import urllib.request
import uuid

B = sys.argv[1]
SITE = sys.argv[2]
PHOTO = sys.argv[3]
EMAIL = "teste@exemplo.test"
SENHA = "senha-de-teste-123"
NOVA = "nova-senha-teste-456"
jar = http.cookiejar.CookieJar()
op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
anon = urllib.request.build_opener()
results = []


def call(a, body=None, hdr=True, raw=None, ctype="application/json", opener=op, method="POST"):
    data = raw if raw is not None else (json.dumps(body).encode() if body is not None else None)
    req = urllib.request.Request(B + "api.php?a=" + a, data=data, method=method)
    if hdr:
        req.add_header("X-Dona", "1")
    if data is not None:
        req.add_header("Content-Type", ctype)
    try:
        r = opener.open(req)
        return r.status, r.read().decode(), dict(r.headers)
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode(), dict(e.headers)


def state():
    with open(SITE + "/data/state.json") as f:
        return json.load(f)


def multipart(path, name):
    b = uuid.uuid4().hex
    head = f'--{b}\r\nContent-Disposition: form-data; name="foto"; filename="{name}"\r\nContent-Type: image/jpeg\r\n\r\n'
    with open(path, "rb") as f:
        return head.encode() + f.read() + f"\r\n--{b}--\r\n".encode(), f"multipart/form-data; boundary={b}"


def check(name, cond, info=""):
    results.append(cond)
    print("OK   " if cond else "FALHA", name, info)


first_id = state()["items"][0]["id"]
s, b, h = call("me", hdr=False, opener=anon, method="GET")
check("visitante não recebe cookie", s == 200 and '"logged":false' in b and "Set-Cookie" not in h)
r = anon.open(B)
b, h = r.read().decode(), dict(r.headers)
check("página pública abre sem cookie", r.status == 200 and "Set-Cookie" not in h and first_id in b)
check("página não expõe a senha", "password" not in b and "$2y$" not in b)
check("salvar sem login é recusado", call("save", {}, opener=anon)[0] == 401)
check("pedido sem cabeçalho é recusado", call("login", {"email": "x"}, hdr=False)[0] == 403)
check("senha errada é recusada", call("login", {"email": EMAIL, "password": "errada"})[0] == 401)
check("login certo é aceito", call("login", {"email": EMAIL.upper(), "password": SENHA})[0] == 200)
check("sessão é reconhecida", '"logged":true' in call("me", hdr=False, method="GET")[1])

st = state()
body = {"version": st["version"], "state": {"config": st["config"], "items": st["items"]}}
body["state"]["items"][0]["price"] = 799
s, b, _ = call("save", body)
check("salvar preço", s == 200 and state()["items"][0]["price"] == 799, b)
check("cópia de segurança é criada", len(os.listdir(SITE + "/data/backups")) == 1)
check("versão antiga dá conflito", call("save", body)[0] == 409)

st = state()
good = {"version": st["version"], "state": {"config": st["config"], "items": st["items"]}}
for label, mut in [
    ("foto com caminho malicioso", lambda i: i.update(photos=["../data/auth.php"])),
    ("foto inexistente", lambda i: i.update(photos=["fotos/nao-existe.jpg"])),
    ("preço inválido", lambda i: i.update(price="10")),
    ("status inválido", lambda i: i.update(status="x")),
    ("categoria inválida", lambda i: i.update(cat="x")),
    ("nome vazio", lambda i: i.update(name="")),
    ("anúncio sem foto", lambda i: i.update(photos=[])),
]:
    bad = json.loads(json.dumps(good))
    mut(bad["state"]["items"][0])
    check(label + " é recusado", call("save", bad)[0] == 422)
check("catálogo fica intacto após recusas", state()["version"] == st["version"])

fake = SITE + "/../falso.jpg"
with open(fake, "wb") as f:
    f.write(b"<?php echo 1;?>")
raw, ct = multipart(fake, "x.jpg")
check("arquivo falso é recusado", call("upload", raw=raw, ctype=ct)[0] == 422)
os.remove(fake)
raw, ct = multipart(PHOTO, "foto.jpg")
s, b, _ = call("upload", raw=raw, ctype=ct)
path = json.loads(b).get("path", "")
check("foto é enviada", s == 200 and os.path.exists(SITE + "/" + path), path)

st = state()
new = {"id": "item-teste", "cat": "sala", "name": "Item <b>teste</b>", "desc": "d", "price": 5, "status": "disponivel", "late": False, "photos": [path]}
s, b, _ = call("save", {"version": st["version"], "state": {"config": st["config"], "items": st["items"] + [new]}})
check("novo anúncio é salvo", s == 200 and state()["items"][-1]["id"] == "item-teste", b)
check("página escapa HTML do catálogo", "<b>teste" not in anon.open(B).read().decode())

check("senha fraca é recusada", call("password", {"current": SENHA, "next": "curta"})[0] == 422)
check("senha atual errada é recusada", call("password", {"current": "x", "next": NOVA})[0] == 401)
check("trocar senha", call("password", {"current": SENHA, "next": NOVA})[0] == 200)
check("sair", call("logout", {})[0] == 200)
check("sessão é encerrada", '"logged":false' in call("me", hdr=False, method="GET")[1])
check("senha antiga não entra", call("login", {"email": EMAIL, "password": SENHA})[0] == 401)
check("senha nova entra", call("login", {"email": EMAIL, "password": NOVA})[0] == 200)
call("logout", {})
os.remove(SITE + "/data/attempts.json")
codes = [call("login", {"email": "x", "password": "y"})[0] for _ in range(6)]
check("bloqueio após 5 erros", codes[-1] == 429, str(codes))
print(sum(results), "de", len(results), "passaram")
sys.exit(0 if all(results) else 1)
