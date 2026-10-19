import type { Metadata } from "next";
import { Footer, Header } from "@/components/landing/LandingPage";
import { LegalPage, Section } from "@/components/legal/LegalPage";

export const metadata: Metadata = {
  title: "Termos de uso",
  description: "Regras de uso e de contratação da Luma, plataforma de gestão de contas a pagar e a receber.",
};

export default function TermosPage() {
  return (
    <>
      <Header />
      <main>
        <LegalPage
          title="Termos de uso"
          intro="Estes termos explicam como funciona a contratação e o uso da Luma. Ao criar uma conta ou contratar um plano, você concorda com eles."
        >
          <Section n={1} title="O que é a Luma">
            <p>
              A Luma é uma plataforma on-line para organizar o financeiro de empresas: contas a pagar e a receber, boletos, despesas recorrentes,
              contratos, documentos, alertas de vencimento, fluxo de caixa e relatórios.
            </p>
            <p>
              <strong>A Luma não faz pagamentos nem movimenta dinheiro.</strong> Ela ajuda a organizar e conferir informações. Todo pagamento é feito por
              você, no seu banco. Marcar uma conta como paga na Luma é apenas um registro.
            </p>
          </Section>

          <Section n={2} title="Contratação, plano e pagamento">
            <ul>
              <li>A assinatura é mensal, com valor conforme a quantidade de usuários do plano escolhido, informado na página de planos.</li>
              <li>A cobrança é feita por um intermediador de pagamentos (Asaas), por Pix, boleto ou cartão de crédito. A Luma não recebe nem armazena dados do seu cartão.</li>
              <li>Não há fidelidade nem multa de cancelamento.</li>
              <li>O acesso é liberado depois da confirmação do pagamento.</li>
              <li>Mudanças de preço serão avisadas com antecedência de pelo menos 30 dias e valem a partir da cobrança seguinte.</li>
            </ul>
          </Section>

          <Section n={3} title="Cancelamento, arrependimento e atraso">
            <ul>
              <li>Você pode cancelar a qualquer momento pelo WhatsApp de atendimento. A cobrança recorrente é interrompida e o acesso continua até o fim do período já pago.</li>
              <li>Na primeira contratação, você pode desistir em até 7 dias e receber de volta o valor pago, conforme o Código de Defesa do Consumidor.</li>
              <li>Se uma mensalidade ficar em atraso, o acesso pode passar a ser somente consulta até a regularização. Seus dados não são apagados por causa do atraso.</li>
            </ul>
          </Section>

          <Section n={4} title="Suas responsabilidades">
            <ul>
              <li>Manter o login e a senha em segurança e não compartilhar o acesso fora dos usuários contratados.</li>
              <li>Conferir os dados lidos automaticamente dos boletos antes de usar e antes de pagar qualquer conta.</li>
              <li>Cadastrar apenas informações que você tem direito de usar e não usar a plataforma para fins ilegais.</li>
            </ul>
          </Section>

          <Section n={5} title="Avisos automáticos e leitura de boletos">
            <p>
              A leitura de boletos, os alertas de vencimento, o alerta de boleto suspeito, o aviso de conta acima da média e a previsão de caixa são
              ferramentas de apoio. Elas podem não identificar todos os casos e não garantem que um boleto seja verdadeiro ou falso. Em caso de dúvida,
              confirme sempre com o fornecedor por um contato que você já conhece.
            </p>
          </Section>

          <Section n={6} title="Disponibilidade e limites de responsabilidade">
            <p>
              Trabalhamos para manter a Luma disponível e segura, mas podem ocorrer interrupções para manutenção ou por falhas de terceiros (como
              provedores de internet, hospedagem e banco de dados). A Luma não se responsabiliza por multas, juros ou prejuízos decorrentes de pagamentos
              feitos ou deixados de fazer, já que a decisão e a execução do pagamento são sempre suas.
            </p>
          </Section>

          <Section n={7} title="Seus dados">
            <p>
              Os dados que você cadastra são seus. Você pode baixar uma cópia a qualquer momento em <strong>Dados e ajustes</strong>. Como tratamos esses
              dados está na Política de privacidade.
            </p>
          </Section>

          <Section n={8} title="Mudanças nestes termos">
            <p>Podemos atualizar estes termos. Mudanças importantes serão avisadas com antecedência pelos canais de contato da sua conta.</p>
          </Section>

          <Section n={9} title="Lei e foro">
            <p>Estes termos seguem as leis brasileiras. Fica eleito o foro do domicílio do contratante consumidor, quando aplicável.</p>
          </Section>
        </LegalPage>
      </main>
      <Footer />
    </>
  );
}
