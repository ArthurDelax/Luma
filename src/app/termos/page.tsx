import type { Metadata } from "next";
import { Footer, Header } from "@/components/landing/LandingPage";
import { LegalPage, Section } from "@/components/legal/LegalPage";

export const metadata: Metadata = {
  title: "Termos de uso",
  description: "Regras de uso e de contratação da Luma, cardápio digital com pedido pelo WhatsApp.",
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
              A Luma é uma plataforma on-line de cardápio digital. A loja cadastra produtos, preços, fotos, adicionais, horários, bairros de entrega e
              cupons, e recebe um link público do cardápio. O cliente final monta o pedido nesse link e o envia pelo próprio WhatsApp para o número da loja.
            </p>
            <p>
              <strong>A Luma não vende os produtos, não recebe pagamentos dos clientes finais e não faz entregas.</strong> A venda, o preparo, a entrega, a
              cobrança e o atendimento são feitos pela loja, diretamente com o cliente.
            </p>
          </Section>

          <Section n={2} title="Contratação, plano e pagamento">
            <ul>
              <li>A assinatura é mensal, por loja, em plano único com o valor informado na página de planos.</li>
              <li>A Luma não cobra comissão sobre os pedidos feitos pelo cardápio.</li>
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
              <li>Se uma mensalidade ficar em atraso, o painel e o cardápio podem ser tirados do ar até a regularização. O cardápio não é apagado por causa do atraso.</li>
            </ul>
          </Section>

          <Section n={4} title="Responsabilidades da loja">
            <ul>
              <li>Manter o login e a senha em segurança e não compartilhar o acesso fora das pessoas contratadas.</li>
              <li>Manter preços, descrições, fotos, horários, taxas e disponibilidade dos produtos corretos e atualizados no cardápio.</li>
              <li>Usar apenas fotos, vídeos, marcas e textos que tenha direito de usar.</li>
              <li>Cumprir as regras de defesa do consumidor, vigilância sanitária e demais leis aplicáveis à venda dos seus produtos.</li>
              <li>Tratar os dados dos clientes que chegam pelo WhatsApp de acordo com a LGPD.</li>
            </ul>
          </Section>

          <Section n={5} title="Montagem do cardápio pela Luma">
            <p>
              Quando a contratação inclui a montagem do cardápio, a Luma cadastra os produtos com base nas informações e imagens enviadas pela loja. A loja
              deve conferir o cardápio antes de divulgá-lo e pode alterá-lo a qualquer momento pelo painel.
            </p>
          </Section>

          <Section n={6} title="Disponibilidade e limites de responsabilidade">
            <p>
              Trabalhamos para manter a Luma disponível e segura, mas podem ocorrer interrupções para manutenção ou por falhas de terceiros (como
              provedores de internet, hospedagem, banco de dados e o próprio WhatsApp). A Luma não se responsabiliza por pedidos não enviados ou não lidos,
              por divergências entre o cardápio e o que a loja vende, nem por prejuízos decorrentes da venda, já que ela é sempre feita pela loja.
            </p>
          </Section>

          <Section n={7} title="Seus dados">
            <p>O cardápio e as imagens que você cadastra são seus. Como tratamos os dados está na Política de privacidade.</p>
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
