"""Testes de isolamento dos dados das empresas (0002_dados_empresa.sql).

Uso: PGHOST=/tmp/lumapg python3 supabase/tests/dados_test.py
Cria um banco descartável "lumadados", aplica o shim + migrações e verifica as regras.
"""
import json, os, subprocess, uuid, sys
P = os.environ.get("PGHOST", "/tmp/lumapg"); DB = "lumadados"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
def psql(args, db="postgres"):
    return subprocess.run(["psql", "-h", P, "-p", "5499", "-U", "postgres", "-d", db, "-tA", "-q", "-v", "ON_ERROR_STOP=1", *args], capture_output=True, text=True)
psql(["-c", f"drop database if exists {DB}"]); psql(["-c", f"create database {DB}"])
for f in ["tests/supabase_shim.sql", "migrations/0001_plataforma.sql", "migrations/0002_dados_empresa.sql", "migrations/0002_dados_empresa.sql"]:
    r = psql(["-f", os.path.join(ROOT, f)], DB)
    if r.returncode: print("erro ao aplicar", f, r.stderr); sys.exit(1)
def run(sql, claims=None):
    pre = "" if claims is None else f"set local role authenticated; select set_config('request.jwt.claims', '{json.dumps(claims)}', true); "
    r = psql(["-c", f"begin; {pre}{sql}; commit;"], DB)
    lines = [l for l in r.stdout.strip().splitlines() if l and l != "SET"]
    return r.returncode, (lines[-1] if lines else ""), r.stderr.strip()
res = []
def check(name, cond, info=""): res.append(("PASS" if cond else "FAIL") + " " + name + ("" if cond else " — " + info))
U = {k: str(uuid.uuid4()) for k in ["adm", "a_admin", "a_fin", "a_cons", "b_admin", "x"]}
for k, v in U.items(): run(f"insert into auth.users values ('{v}', '{k}@t.com')")
run(f"insert into platform_admins values ('{U['adm']}')")
c = lambda k, aal="aal1": {"sub": U[k], "email": f"{k}@t.com", "aal": aal, "role": "authenticated"}
orgA, orgB = str(uuid.uuid4()), str(uuid.uuid4())
run(f"insert into organizations (id,name,responsible_name,responsible_email,licenses,monthly_price_cents) values ('{orgA}','Empresa A','Ana','a@t.com',3,0),('{orgB}','Empresa B','Bia','b@t.com',1,0)")
run(f"insert into memberships values ('{orgA}','{U['a_admin']}','administrador','ativo'),('{orgA}','{U['a_fin']}','financeiro','ativo'),('{orgA}','{U['a_cons']}','consulta','ativo'),('{orgB}','{U['b_admin']}','administrador','ativo')")
ins = lambda org, kind, id, data='{"amount": 10}': f"insert into org_records (org_id, kind, id, data) values ('{org}','{kind}','{id}','{data}')"
rc, out, err = run(ins(orgA, "bill", "cta_1"), c("a_admin")); check("administrador da empresa A cria conta", rc == 0, err)
rc, out, err = run(ins(orgA, "bill", "cta_2"), c("a_fin")); check("financeiro da empresa A cria conta", rc == 0, err)
rc, out, err = run(ins(orgA, "bill", "cta_3"), c("a_cons")); check("consulta NÃO cria conta", rc != 0, err)
rc, out, err = run(ins(orgA, "alert_read", "al_1", "{}"), c("a_cons")); check("consulta pode marcar alerta como lido", rc == 0, err)
rc, out, err = run(ins(orgB, "bill", "cta_b"), c("b_admin")); check("empresa B cria sua conta", rc == 0, err)
rc, out, err = run("select string_agg(id, ',' order by id) from org_records where kind='bill'", c("a_cons")); check("consulta lê as contas da empresa A", out == "cta_1,cta_2", out)
rc, out, err = run("select count(*) from org_records", c("b_admin")); check("isolamento: empresa B só vê o próprio registro", out == "1", out)
rc, out, err = run(f"select count(*) from org_records where org_id='{orgA}'", c("b_admin")); check("isolamento: B não lê A mesmo filtrando pelo id", out == "0", out)
rc, out, err = run(ins(orgA, "bill", "cta_hack"), c("b_admin")); check("isolamento: B não grava na empresa A", rc != 0, err)
rc, out, err = run(f"update org_records set data='{{}}' where org_id='{orgA}'", c("b_admin")); _, n, _ = run(f"select count(*) from org_records where org_id='{orgA}' and data='{{}}'::jsonb and kind='bill'"); check("isolamento: B não altera A", n == "0", n)
rc, out, err = run(f"delete from org_records where org_id='{orgA}'", c("b_admin")); _, n, _ = run(f"select count(*) from org_records where org_id='{orgA}'"); check("isolamento: B não apaga A", n == "3", n)
rc, out, err = run(f"update org_records set org_id='{orgB}' where id='cta_1'", c("a_admin")); _, n, _ = run(f"select org_id from org_records where id='cta_1'"); check("não dá para mover registro para outra empresa", n == orgA, n)
rc, out, err = run(f"update org_records set data='{{\"amount\":99}}' where id='cta_1'", c("a_cons")); _, n, _ = run("select data->>'amount' from org_records where id='cta_1'"); check("consulta NÃO altera", n == "10", n)
rc, out, err = run(f"delete from org_records where id='cta_2'", c("a_cons")); _, n, _ = run("select count(*) from org_records where id='cta_2'"); check("consulta NÃO apaga", n == "1", n)
rc, out, err = run("select count(*) from org_records", c("adm", "aal2")); check("dono da plataforma NÃO lê dados dos clientes", out == "0", out)
rc, out, err = run("select count(*) from org_records", c("x")); check("usuário sem empresa não lê nada", out == "0", out)
r = psql(["-c", "begin; set local role anon; select count(*) from org_records; commit;"], DB); check("anônimo não acessa", r.returncode != 0 or r.stdout.strip().splitlines()[-1] == "0", r.stderr)
rc, out, err = run("select updated_by from org_records where id='cta_1'"); check("registra quem alterou", out == U["a_admin"], out)
# suspensa = somente leitura; cancelada = sem acesso
run(f"update organizations set status='suspensa' where id='{orgA}'")
rc, out, err = run(ins(orgA, "bill", "cta_s"), c("a_admin")); check("empresa suspensa não grava", rc != 0, err)
rc, out, err = run("select count(*) from org_records where kind='bill'", c("a_admin")); check("empresa suspensa ainda lê", out == "2", out)
run(f"update organizations set status='cancelada' where id='{orgA}'")
rc, out, err = run("select count(*) from org_records", c("a_admin")); check("empresa cancelada não lê", out == "0", out)
run(f"update organizations set status='ativa' where id='{orgA}'")
run(f"update memberships set status='desativado' where user_id='{U['a_fin']}'")
rc, out, err = run(ins(orgA, "bill", "cta_d"), c("a_fin")); check("usuário desativado não grava", rc != 0, err)
rc, out, err = run("select count(*) from org_records", c("a_fin")); check("usuário desativado não lê", out == "0", out)
# anexos
obj = lambda org, name: f"insert into storage.objects (bucket_id, name) values ('anexos', '{org}/{name}')"
rc, out, err = run(obj(orgA, "boleto.pdf"), c("a_admin")); check("anexo: empresa A envia PDF", rc == 0, err)
rc, out, err = run(obj(orgA, "x.pdf"), c("b_admin")); check("anexo: B não envia para a pasta de A", rc != 0, err)
rc, out, err = run(obj(orgA, "y.pdf"), c("a_cons")); check("anexo: consulta não envia", rc != 0, err)
rc, out, err = run("select count(*) from storage.objects", c("b_admin")); check("anexo: B não lê arquivos de A", out == "0", out)
rc, out, err = run("select count(*) from storage.objects", c("a_cons")); check("anexo: consulta lê arquivos da própria empresa", out == "1", out)
rc, out, err = run("insert into storage.objects (bucket_id, name) values ('anexos', '../etc/x.pdf')", c("a_admin")); check("anexo: caminho inválido é recusado", rc != 0, err)
rc, out, err = run("delete from storage.objects", c("b_admin")); _, n, _ = run("select count(*) from storage.objects"); check("anexo: B não apaga arquivos de A", n == "1", n)
_, n, _ = run("select public from storage.buckets where id='anexos'"); check("bucket de anexos é privado", n == "f", n)
print("\n".join(res)); print(f"{sum(r.startswith('PASS') for r in res)}/{len(res)}")
sys.exit(0 if all(r.startswith("PASS") for r in res) else 1)
