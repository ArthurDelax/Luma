"""Testes do suporte (0004_suporte.sql).

Uso: PGHOST=/tmp/lumapg python3 supabase/tests/suporte_test.py
"""
import json, os, subprocess, uuid, sys
P = os.environ.get("PGHOST", "/tmp/lumapg"); DB = "lumasuporte"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
def psql(args, db="postgres"):
    return subprocess.run(["psql", "-h", P, "-p", "5499", "-U", "postgres", "-d", db, "-tA", "-q", "-v", "ON_ERROR_STOP=1", *args], capture_output=True, text=True)
psql(["-c", f"drop database if exists {DB}"]); psql(["-c", f"create database {DB}"])
for f in ["tests/supabase_shim.sql", "migrations/0001_plataforma.sql", "migrations/0002_dados_empresa.sql", "migrations/0003_categorias.sql", "migrations/0004_suporte.sql"]:
    r = psql(["-f", os.path.join(ROOT, f)], DB)
    if r.returncode: print("erro ao aplicar", f, r.stderr); sys.exit(1)
def run(sql, claims=None):
    pre = "" if claims is None else f"set local role authenticated; select set_config('request.jwt.claims', '{json.dumps(claims)}', true); "
    r = psql(["-c", f"begin; {pre}{sql}; commit;"], DB)
    lines = [l for l in r.stdout.strip().splitlines() if l and l != "SET" and not l.startswith("{\"sub\"")]
    return r.returncode, (lines[-1] if lines else ""), r.stderr.strip()
res = []
def check(name, cond, info=""): res.append(("PASS" if cond else "FAIL") + " " + name + ("" if cond else " — " + info))
U = {k: str(uuid.uuid4()) for k in ["adm", "a1", "a2", "b1", "x"]}
for k, v in U.items(): run(f"insert into auth.users values ('{v}', '{k}@t.com')")
run(f"insert into platform_admins values ('{U['adm']}')")
c = lambda k, aal="aal1": {"sub": U[k], "email": f"{k}@t.com", "aal": aal, "role": "authenticated"}
A, B = str(uuid.uuid4()), str(uuid.uuid4())
run(f"insert into organizations (id,name,responsible_name,responsible_email,licenses,monthly_price_cents) values ('{A}','Empresa A','Ana','a@t.com',3,0),('{B}','Empresa B','Bia','b@t.com',1,0)")
run(f"insert into memberships values ('{A}','{U['a1']}','administrador','ativo'),('{A}','{U['a2']}','consulta','ativo'),('{B}','{U['b1']}','administrador','ativo')")
rc, tA, err = run(f"select support_open('{A}', 'Não consigo importar boleto', 'O PDF não abre')", c("a1")); check("cliente abre chamado", rc == 0 and len(tA) == 36, err)
rc, out, err = run(f"select support_open('{A}', 'Dúvida', 'Olá')", c("a2")); check("usuário consulta também pede ajuda", rc == 0, err)
rc, out, err = run(f"select support_open('{A}', 'Hack', 'x')", c("b1")); check("não abre chamado em outra empresa", rc != 0, err)
rc, out, err = run(f"select support_open('{A}', 'Hack', 'x')", c("x")); check("usuário sem empresa não abre chamado", rc != 0, err)
rc, out, err = run(f"select count(*) from support_list('{A}')", c("a2")); check("empresa vê seus chamados", out == "2", out + err)
rc, out, err = run(f"select count(*) from support_list('{A}')", c("b1")); check("isolamento: B não lista chamados de A", rc != 0, err)
rc, out, err = run(f"select count(*) from support_thread('{tA}')", c("b1")); check("isolamento: B não lê conversa de A", rc != 0, err)
rc, out, err = run(f"select support_send('{tA}', 'intromissão')", c("b1")); check("isolamento: B não escreve em chamado de A", rc != 0, err)
rc, out, err = run("select count(*) from support_tickets", c("a1")); check("tabela de chamados não é acessível diretamente", rc != 0 or out == "0", out)
rc, out, err = run("select count(*) from support_messages", c("b1")); check("tabela de mensagens não é acessível diretamente", rc != 0 or out == "0", out)
rc, out, err = run("select count(*) from admin_support_list(null)", c("adm", "aal1")); check("admin sem 2 etapas não vê suporte", rc != 0, err)
rc, out, err = run("select count(*) from admin_support_list(null)", c("a1")); check("cliente não usa a lista do admin", rc != 0, err)
rc, out, err = run("select string_agg(org_name || ':' || unread, ',') from admin_support_list(null)", c("adm", "aal2")); check("admin vê chamados de todas as empresas, como não lidos", out.count("Empresa A:true") == 2, out)
rc, out, err = run(f"select count(*) from support_thread('{tA}')", c("adm", "aal2")); check("admin lê a conversa", out == "1", out)
rc, out, err = run(f"select unread from admin_support_list(null) where id = '{tA}'", c("adm", "aal2")); check("ao abrir, fica lido para o admin", out == "f", out)
rc, out, err = run(f"select support_send('{tA}', 'Oi! Pode me mandar o PDF?')", c("adm", "aal2")); check("admin responde", rc == 0, err)
rc, out, err = run(f"select author_role from support_messages where ticket_id = '{tA}' order by id desc limit 1"); check("resposta registrada como suporte", out == "suporte", out)
rc, out, err = run(f"select status || ':' || unread from support_list('{A}') where id = '{tA}'", c("a1")); check("cliente vê 'respondido' e não lido", out == "respondido:true", out)
rc, out, err = run(f"select count(*) from support_thread('{tA}')", c("a1")); rc2, out2, _ = run(f"select unread from support_list('{A}') where id = '{tA}'", c("a1")); check("ao abrir, fica lido para o cliente", out == "2" and out2 == "f", out + "/" + out2)
rc, out, err = run(f"select author_email from support_thread('{tA}') where author_role = 'suporte'", c("a1")); check("e-mail do atendente não é exposto ao cliente", out == "", out)
rc, out, err = run(f"select support_send('{tA}', 'Enviei por e-mail')", c("a1")); rc2, out2, _ = run(f"select status || ':' || unread from admin_support_list(null) where id = '{tA}'", c("adm", "aal2")); check("cliente responde → volta 'aberto' e não lido para o admin", out2 == "aberto:true", out2)
rc, out, err = run(f"select support_set_status('{tA}', 'respondido')", c("a1")); check("cliente não marca como 'respondido'", rc != 0, err)
rc, out, err = run(f"select support_set_status('{tA}', 'fechado')", c("a1")); check("cliente encerra o próprio chamado", rc == 0, err)
rc, out, err = run(f"select support_set_status('{tA}', 'aberto')", c("adm", "aal2")); check("admin reabre", rc == 0, err)
rc, out, err = run(f"select support_send('{tA}', '')", c("a1")); check("mensagem vazia é recusada", rc != 0, err)
r = psql(["-c", f"begin; set local role anon; select support_list('{A}'); commit;"], DB); check("anônimo não acessa", r.returncode != 0, r.stderr)
for i in range(9): run(f"select support_open('{A}', 'Teste {i}', 'x')", c("a2"))
rc, out, err = run(f"select support_open('{A}', 'Spam', 'x')", c("a2")); check("limite de 10 chamados/24h por usuário", rc != 0 and "limite" in err, err)
print("\n".join(res)); print(f"{sum(r.startswith('PASS') for r in res)}/{len(res)}")
sys.exit(0 if all(r.startswith("PASS") for r in res) else 1)
