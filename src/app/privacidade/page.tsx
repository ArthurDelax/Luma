import type { Metadata } from "next";
import { Footer, Header } from "@/components/landing/LandingPage";
import { LegalPage, Section } from "@/components/legal/LegalPage";

export const metadata: Metadata = {
  title: "Política de privacidade",
  description: "Como a Luma coleta, usa, guarda e protege os dados das empresas clientes, conforme a LGPD.",
};

export default function PrivacidadePage() {
  return (
    <>
      <Header />
      <main>
        <LegalPage
          title="Política de privacidade"
          intro="Esta política explica quais dados a Luma usa, para quê, onde ficam guardados e quais são os seus direitos, de acordo com a Lei Geral de Proteção de Dados (LGPD, Lei nº 13.709/2018)."
        >
          <Section n={1} title="Quais dados usamos">
            <ul>
              <li><strong>Dados de acesso:</strong> nome, e-mail e senha dos usuários da empresa (a senha é guardada de forma criptografada pelo provedor de login).</li>
              <li><strong>Dados da empresa:</strong> razão social, CNPJ e dados de contato informados na contratação.</li>
              <li><strong>Dados financeiros que você cadastra:</strong> contas a pagar e a receber, fornecedores, clientes, valores, vencimentos, linhas digitáveis, chaves Pix, contratos, documentos e anexos em PDF.</li>
              <li><strong>Mensagens de suporte</strong> enviadas pela central de ajuda.</li>
            </ul>
          </Section>

          <Section n={2} title="Para que usamos">
            <ul>
              <li>Prestar o serviço: mostrar seus vencimentos, alertas, fluxo de caixa e relatórios.</li>
              <li>Dar acesso aos usuários autorizados da sua empresa e manter a conta segura.</li>
              <li>Atender pedidos de suporte e cobrar a assinatura.</li>
            </ul>
            <p>Não vendemos nem alugamos seus dados, e não os usamos para publicidade.</p>
          </Section>

          <Section n={3} title="Onde os dados ficam e com quem são compartilhados">
            <ul>
              <li><strong>Banco de dados e arquivos:</strong> provedor de nuvem Supabase, com acesso restrito por empresa — cada empresa só enxerga os próprios dados.</li>
              <li><strong>Pagamentos da assinatura:</strong> intermediador Asaas, que recebe os dados necessários para a cobrança. A Luma não recebe dados do seu cartão.</li>
              <li><strong>Leitura de boletos:</strong> a leitura do PDF é feita no seu próprio navegador. O arquivo só é guardado se você escolher anexá-lo à conta.</li>
              <li>Podemos compartilhar dados quando a lei ou uma ordem judicial exigir.</li>
            </ul>
          </Section>

          <Section n={4} title="Cookies e armazenamento no navegador">
            <p>
              Usamos apenas o armazenamento do navegador necessário para o funcionamento: manter seu login durante o uso e guardar os dados da
              demonstração. Não usamos cookies de publicidade nem ferramentas de rastreamento de terceiros.
            </p>
          </Section>

          <Section n={5} title="Segurança">
            <ul>
              <li>Conexão criptografada (HTTPS) em todo o site.</li>
              <li>Separação dos dados por empresa no banco de dados e permissões por usuário.</li>
              <li>Acesso administrativo protegido por verificação em duas etapas.</li>
            </ul>
            <p>Nenhum sistema é 100% imune a falhas. Se ocorrer um incidente que afete seus dados, avisaremos você e as autoridades quando a lei exigir.</p>
          </Section>

          <Section n={6} title="Por quanto tempo guardamos">
            <p>
              Enquanto a assinatura estiver ativa. Depois do cancelamento, os dados ficam disponíveis por 30 dias para você baixar uma cópia e, em seguida,
              são apagados, exceto o que precisarmos manter por obrigação legal (por exemplo, registros de cobrança).
            </p>
          </Section>

          <Section n={7} title="Seus direitos">
            <p>Você pode, a qualquer momento:</p>
            <ul>
              <li>confirmar quais dados temos e pedir uma cópia (também disponível em Dados e ajustes);</li>
              <li>corrigir dados incompletos ou errados;</li>
              <li>pedir a exclusão dos dados e o encerramento da conta;</li>
              <li>tirar dúvidas sobre o uso dos seus dados.</li>
            </ul>
            <p>Os pedidos são feitos pelo WhatsApp de atendimento informado no site.</p>
          </Section>

          <Section n={8} title="Mudanças nesta política">
            <p>Se esta política mudar de forma importante, avisaremos pelos canais de contato da sua conta antes de a mudança valer.</p>
          </Section>
        </LegalPage>
      </main>
      <Footer />
    </>
  );
}
