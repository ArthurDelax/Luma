import subprocess, json, uuid, sys
import os
P=os.environ.get("PGHOST","/tmp/lumapg")
def run(sql, role="postgres", claims=None):
    pre = ""
    if role != "postgres":
        pre = f"set local role {role}; "
        if claims is not None:
            pre += f"select set_config('request.jwt.claims', '{json.dumps(claims)}', true); "
    full = f"begin; {pre}{sql}; commit;"
    r = subprocess.run(["psql","-h",P,"-p","5499","-U","postgres","-tA","-q","-v","ON_ERROR_STOP=1","-c",full],capture_output=True,text=True)
    lines=[l for l in r.stdout.strip().splitlines() if l and l!="SET"]
    return r.returncode, (lines[-1] if lines else ""), r.stderr.strip()
results=[]
def check(name, cond, info=""):
    results.append(("PASS" if cond else "FAIL")+" "+name+(" — "+info if info and not cond else ""))
A=str(uuid.uuid4()); X=str(uuid.uuid4()); C=str(uuid.uuid4()); D=str(uuid.uuid4()); E=str(uuid.uuid4())
for uid,email in [(A,"dono@luma.com"),(X,"intruso@x.com"),(C,"cliente@empresa.com"),(D,"outro@empresa2.com"),(E,"segundo@empresa.com")]:
    run(f"insert into auth.users values ('{uid}','{email}')")
run(f"insert into public.platform_admins(user_id) values ('{A}')")
adm1={"sub":A,"email":"dono@luma.com","aal":"aal1","role":"authenticated"}
adm2=dict(adm1,aal="aal2")
intr={"sub":X,"email":"intruso@x.com","aal":"aal2","role":"authenticated"}
cli={"sub":C,"email":"cliente@empresa.com","aal":"aal1","role":"authenticated"}
oth={"sub":D,"email":"outro@empresa2.com","aal":"aal1","role":"authenticated"}
sec={"sub":E,"email":"segundo@empresa.com","aal":"aal1","role":"authenticated"}
create = "select admin_create_organization('{n}','11.222.333/0001-81','Fulano','{e}',{l},12980,'2026-11-10','manual','obs')"
rc,out,err=run(create.format(n="Empresa A",e="Cliente@Empresa.com",l=1),"authenticated",adm1)
check("admin sem 2 etapas não cria empresa", rc!=0 and "acesso negado" in err, err)
rc,out,err=run("select am_i_platform_admin()","authenticated",adm1); check("tela sabe que é admin (precisa de 2 etapas)", out=="t", out)
rc,out,err=run(create.format(n="Empresa A",e="Cliente@Empresa.com",l=1),"authenticated",adm2)
check("admin com 2 etapas cria empresa", rc==0, err); tokA=json.loads(out)["token"]; orgA=json.loads(out)["org_id"]
rc,out,err=run(create.format(n="Empresa B",e="outro@empresa2.com",l=3),"authenticated",adm2); tokB=json.loads(out)["token"]; orgB=json.loads(out)["org_id"]
check("token tem 64 hex", len(tokA)==64)
rc,out,err=run("select count(*) from invitations where token_hash = '"+tokA+"'"); check("token não é salvo em texto puro", out=="0")
rc,out,err=run("select admin_stats()","authenticated",adm2); st=json.loads(out)
check("estatísticas: 2 empresas, R$ 259,60/mês, 2 convites pendentes", st["total"]==2 and st["receita_mensal_centavos"]==25960 and st["convites_pendentes"]==2, out)
rc,out,err=run(create.format(n="Hack",e="a@b.com",l=1),"authenticated",intr); check("usuário comum não cria empresa", rc!=0 and "acesso negado" in err, err)
rc,out,err=run("select admin_stats()","authenticated",intr); check("usuário comum não vê estatísticas", rc!=0)
rc,out,err=run("select count(*) from organizations","authenticated",intr); check("usuário comum não lê empresas", out=="0", out)
rc,out,err=run("select count(*) from invitations","authenticated",intr); check("convites não são legíveis diretamente", out=="0", out)
rc,out,err=run("select count(*) from platform_admins","authenticated",intr); check("lista de admins não é legível", out=="0", out)
rc,out,err=run("insert into platform_admins values ('"+X+"')","authenticated",intr); check("usuário não consegue se tornar admin", rc!=0, err)
rc,out,err=run("update organizations set licenses=10","authenticated",intr); rc2,out2,_=run("select sum(licenses) from organizations"); check("usuário não altera empresas", out2=="4", out2)
rc,out,err=run(create.format(n="Anon",e="a@b.com",l=1),"anon",{}); check("anônimo não executa funções de admin", rc!=0, err)
rc,out,err=run(f"select invitation_info('{tokA}')","anon",{}); info=json.loads(out); check("convite válido mostra empresa e e-mail", info.get("valid") and info["org_name"]=="Empresa A" and info["email"]=="cliente@empresa.com", out)
rc,out,err=run("select invitation_info('"+"0"*64+"')","anon",{}); check("token errado é recusado", json.loads(out)["valid"]==False)
rc,out,err=run(f"select accept_invitation('{tokA}')","authenticated",oth); check("convite não aceita outro e-mail", rc!=0 and "outro e-mail" in err, err)
rc,out,err=run(f"select accept_invitation('{tokA}')","anon",{}); check("convite exige login", rc!=0, err)
rc,out,err=run(f"select accept_invitation('{tokA}')","authenticated",cli); check("cliente aceita o convite", rc==0, err)
rc,out,err=run(f"select accept_invitation('{tokA}')","authenticated",cli); check("convite não pode ser reutilizado", rc!=0 and "já foi utilizado" in err, err)
rc,out,err=run(f"select accept_invitation('{tokB}')","authenticated",oth); check("cliente B aceita o convite", rc==0, err)
rc,out,err=run("select string_agg(name, ',') from my_organizations()","authenticated",cli); check("cliente A vê só a própria empresa", out=="Empresa A", out)
rc,out,err=run("select string_agg(name, ',') from organizations","authenticated",cli); check("isolamento: cliente A não lê a empresa B", out=="Empresa A", out)
rc,out,err=run("select string_agg(name, ',') from organizations","authenticated",oth); check("isolamento: cliente B não lê a empresa A", out=="Empresa B", out)
rc,out,err=run("select count(*) from memberships","authenticated",cli); check("cliente vê só o próprio vínculo", out=="1", out)
rc,out,err=run(f"select admin_regenerate_invite('{orgA}')","authenticated",adm2); tok2=out
run(f"update invitations set email='segundo@empresa.com' where token_hash = luma_hash_token('{tok2}')")
rc,out,err=run(f"select accept_invitation('{tok2}')","authenticated",sec); check("limite de licenças é respeitado", rc!=0 and "licenças" in err, err)
rc,out,err=run(f"select admin_update_organization('{orgB}', 0, 0, null, 'ativa', '')","authenticated",adm2); check("licenças fora do limite são recusadas", rc!=0, err)
run(f"select admin_regenerate_invite('{orgB}')","authenticated",adm2)
rc,out,err=run(f"select admin_update_organization('{orgA}', 1, 9990, '2026-12-10', 'suspensa', 'atrasou')","authenticated",adm2); check("admin altera status/valor", rc==0, err)
rc,out,err=run("select string_agg(action, ',' order by created_at) from admin_audit_log"); check("histórico registra as ações", "empresa_criada" in out and "convite_aceito" in out and "empresa_atualizada" in out and "convite_reenviado" in out, out)
rc,out,err=run("select count(*) from admin_audit(50)","authenticated",adm2); check("admin lê o histórico", rc==0 and int(out)>=5, out)
rc,out,err=run("select count(*) from admin_audit(50)","authenticated",intr); check("usuário comum não lê o histórico", rc!=0)
rc,out,err=run("select invite_status||':'||active_users from admin_list_organizations() where name='Empresa A'","authenticated",adm2); check("lista mostra convite ativado e usuários", out=="ativado:1", out)
print("\n".join(results)); print(sum(r.startswith("PASS") for r in results),"/",len(results))
