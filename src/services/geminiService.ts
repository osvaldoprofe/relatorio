import { GoogleGenAI } from '@google/genai';

let genAI: GoogleGenAI | null = null;

function getAI() {
  if (!genAI) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
      throw new Error('Chave de API do Gemini não encontrada. Configure a variável GEMINI_API_KEY no ambiente.');
    }
    genAI = new GoogleGenAI({ apiKey });
  }
  return genAI;
}

export async function generateReport(transcript: string, audioData?: { base64: string; mimeType: string }): Promise<string> {
  const ai = getAI();
  const prompt = `Você é um assistente especializado em Orientação Educacional e Apoio Pedagógico na Escola Estadual Frederico J. P. Neto.
Sua tarefa é ler transcrições de relatos verbais enviados pelo orientador, extrair as informações relevantes e preencher o "Relatório Técnico – Equipe Multiprofissional".

Objetivo: Transformar relatos brutos em um texto estruturado, profissional e direto, seguindo fielmente a organização do documento padrão.

Diretrizes Gerais:
- Seja claro, sucinto e direto.
- Utilize linguagem formal técnica adequada ao ambiente escolar.
- Caso alguma informação de identificação (como CPF, celular, etc) não seja dita na transcrição, deixe o campo exatamente como "__________________" para preenchimento manual.
- O formato de saída NÃO DEVE conter marcações Markdown fortes (como hashtags # para títulos) que prejudiquem a cópia limpa para um documento Word. Use quebras de linha normais e mantenha a numeração romana conforme especificado.

Estrutura de Saída (Siga rigorosamente esta ordem e formato):

I – IDENTIFICAÇÃO
Nome do estudante: [nome do estudante ou __________________]
Idade: [idade ou __________________]
Turma: [turma descrita ou __________________]
Turno: [turno ou __________________]
CPF: __________________
Celular: __________________

II – DESCRIÇÃO DA DEMANDA
[Resuma o motivo do atendimento ou a queixa principal relatada de forma objetiva.]

III – PROCEDIMENTOS TÉCNICOS
[Liste os procedimentos ou ações realizadas (ex: escuta qualificada, mediação de conflito, orientação aos responsáveis, encaminhamentos) baseados no relato.]

IV – CONTEXTUALIZAÇÃO DA DEMANDA
[Descreva o histórico e detalhes do caso abordado.
ATENÇÃO (Conhecimentos Prévios Injetados):
- Se o relato citar "Igor Silva" (ou Igor da Silva), você DEVE incluir nesta seção que o estudante tem necessidade de uso de recursos visuais.
- Se o relato citar "Yasmin Solino" (ou Yasmin), você DEVE incluir nesta seção a necessidade de um ambiente estruturado para a estudante.
- Se o relato citar "Hemyly Vitoria" (ou Hemyly), você DEVE incluir nesta seção a sua dependência de proteção auricular no ambiente escolar.]

V – PARECER TÉCNICO
[Apresente uma conclusão técnica ou recomendações pedagógicas com tom formal e de orientação, sugerindo passos futuros baseados no cenário relatado.]

Data de Geração: ${new Date().toLocaleDateString('pt-BR')}

Aqui está o relato a ser processado:
"""
${transcript.trim() ? transcript : (audioData ? "O relato principal se encontra no áudio enviado." : "")}
"""`;

  const contents: any[] = [];
  if (audioData) {
    contents.push({
      inlineData: {
        data: audioData.base64,
        mimeType: audioData.mimeType
      }
    });
  }
  contents.push({ text: prompt });

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: contents,
    });
    return response.text || '';
  } catch (err) {
    console.error("Gemini Error:", err);
    throw new Error('Falha ao processar o relatório via IA. Verifique sua conexão e tente novamente.');
  }
}
