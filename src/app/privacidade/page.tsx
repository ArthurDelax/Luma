import type { Metadata } from "next";
import { Footer, Header } from "@/components/landing/LandingPage";
import { LegalPage, Section } from "@/components/legal/LegalPage";

export const metadata: Metadata = {
  title: "Política de privacidade",
  description: "Como a Luma coleta, usa, guarda e protege os dados das lojas e dos clientes que pedem pelo cardápio, conforme a LGPD.",
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
          <Section n={1} title="Dados das lojas">
            <ul>
              <li><strong>Dados de acesso:</strong> nome, e-mail e senha das pessoas da loja com acesso ao painel (a senha é guardada de forma criptografada pelo provedor de login).</li>
              <li><strong>Dados da loja:</strong> nome, CNPJ (quando informado) e dados de contato informados na contratação.</li>
              <li><strong>Cardápio:</strong> produtos, preços, fotos, vídeos, horários, endereço, bairros e taxas de entrega, cupons e o número de WhatsApp que recebe os pedidos. Essas informações são públicas no link do cardápio.</li>
              <li><strong>Mensagens de suporte</strong> enviadas pela central de ajuda.</li>
            </ul>
          </Section>

          <Section n={2} title="Dados de quem faz pedidos pelo cardápio">
            <p>
              Nome, telefone, endereço e forma de pagamento digitados no cardápio <strong>não são enviados aos servidores da Luma</strong>. Eles ficam
              guardados só no navegador do próprio cliente (para preencher o próximo pedido) e seguem para a loja na mensagem que o cliente envia pelo
              WhatsApp. A partir daí, a loja é a responsável por esses dados.
            </p>
            <p>Quando o cliente digita o CEP, o número é consultado no serviço público ViaCEP para preencher a rua.</p>
          </Section>

          <Section n={3} title="Para que usamos">
            <ul>
              <li>Prestar o serviço: publicar o cardápio da loja e permitir que ela o edite.</li>
              <li>Dar acesso às pessoas autorizadas da loja e manter a conta segura.</li>
              <li>Atender pedidos de suporte e cobrar a assinatura.</li>
            </ul>
            <p>Não vendemos nem alugamos dados, e não os usamos para publicidade.</p>
          </Section>

          <Section n={4} title="Onde os dados ficam e com quem são compartilhados">
            <ul>
              <li><strong>Banco de dados e arquivos:</strong> provedor de nuvem Supabase, com acesso restrito por loja. As fotos e vídeos do cardápio ficam em uma pasta pública, pois aparecem no cardápio.</li>
              <li><strong>Pagamentos da assinatura:</strong> intermediador Asaas, que recebe os dados necessários para a cobrança. A Luma não recebe dados do seu cartão.</li>
              <li><strong>Pedidos:</strong> enviados pelo WhatsApp do cliente, serviço da Meta, de acordo com as regras do próprio WhatsApp.</li>
              <li>Podemos compartilhar dados quando a lei ou uma ordem judicial exigir.</li>
            </ul>
          </Section>

          <Section n={5} title="Cookies e armazenamento no navegador">
            <p>
              Usamos apenas o armazenamento do navegador necessário para o funcionamento: manter o login durante o uso, guardar a sacola e os dados do
              último pedido no aparelho do cliente e guardar os dados da demonstração. Não usamos cookies de publicidade nem ferramentas de rastreamento
              de terceiros.
            </p>
          </Section>

          <Section n={6} title="Segurança">
            <ul>
              <li>Conexão criptografada (HTTPS) em todo o site.</li>
              <li>Separação dos dados por loja no banco de dados e permissões por usuário.</li>
              <li>Acesso administrativo protegido por verificação em duas etapas.</li>
            </ul>
            <p>Nenhum sistema é 100% imune a falhas. Se ocorrer um incidente que afete seus dados, avisaremos você e as autoridades quando a lei exigir.</p>
          </Section>

          <Section n={7} title="Por quanto tempo guardamos">
            <p>
              Enquanto a assinatura estiver ativa. Depois do cancelamento, o cardápio fica fora do ar e os dados são guardados por 30 dias para você pedir
              uma cópia e, em seguida, são apagados, exceto o que precisarmos manter por obrigação legal (por exemplo, registros de cobrança).
            </p>
          </Section>

          <Section n={8} title="Seus direitos">
            <p>Você pode, a qualquer momento:</p>
            <ul>
              <li>confirmar quais dados temos e pedir uma cópia;</li>
              <li>corrigir dados incompletos ou errados;</li>
              <li>pedir a exclusão dos dados e o encerramento da conta;</li>
              <li>tirar dúvidas sobre o uso dos seus dados.</li>
            </ul>
            <p>Os pedidos são feitos pelo WhatsApp de atendimento informado no site.</p>
          </Section>

          <Section n={9} title="Mudanças nesta política">
            <p>Se esta política mudar de forma importante, avisaremos pelos canais de contato da sua conta antes de a mudança valer.</p>
          </Section>
        </LegalPage>
      </main>
      <Footer />
    </>
  );
}
