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
Sua tarefa é ler transcrições de relatos verbais enviados pelo orientador, extrair as informações relevantes e preencher o "RELATÓRIO TÉCNICO – EQUIPE MULTIPROFISSIONAL".

Objetivo: Transformar relatos brutos em um texto estruturado, profissional e direto, seguindo fielmente a organização do documento padrão da escola.

Diretrizes Gerais:
- Seja claro, sucinto e direto.
- Utilize linguagem formal técnica adequada ao ambiente escolar.
- Siga exatamente o layout e campos do formulário oficial.
- Caso alguma informação de identificação não seja dita na transcrição, deixe o campo exatamente como "__________________" para preenchimento manual.
- NÃO use negritos, asteriscos (*) ou qualquer marcação Markdown. O texto deve ser puro e limpo.
- Siga exatamente o layout e campos do formulário oficial sem decorações de texto.

ESTRUTURA DE SAÍDA (Siga rigorosamente este layout e NÃO use asteriscos):

RELATÓRIO TÉCNICO – EQUIPE MULTIPROFISSIONAL

I – IDENTIFICAÇÃO
ESTUDANTE (A): [nome do estudante ou __________________] IDADE: [idade ou ________]
TURMA: [turma ou __________] TURNO: [turno ou ___________________] CELULAR: [celular ou ___________________________]
RESPONSÁVEL 1: [nome ou __________________________________________] CELULAR: [celular ou ______________]
RESPONSÁVEL 2: [nome ou __________________________________________] CELULAR: [celular ou ______________]
Data: ${new Date().toLocaleDateString('pt-BR')} Horário: [horário ou _____________]

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

ORIENTAÇÃO EDUCACIONAL: _____________________________________________________
PSICÓLOGA (A):____________________________________________________________________
ASSISTENTE SOCIAL: _____________________________________________________________
RESPONSÁVEL: __________________________________________________________________
ESTUDANTE:_____________________________________________________________________

Aqui está o relato a ser processado:
"""
${transcript.trim() ? transcript : (audioData ? "O relato principal se encontra no áudio enviado." : "")}
"""`;

  const parts: any[] = [];
  if (audioData) {
    parts.push({
      inlineData: {
        data: audioData.base64,
        mimeType: audioData.mimeType
      }
    });
  }
  parts.push({ text: prompt });

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: [{ parts }],
    });
    const resultText = response.text || '';
    // Remove todos os asteriscos do relatório para garantir texto limpo
    return resultText.replace(/\*/g, '');
  } catch (err: any) {
    console.error("Gemini Error:", err);
    const apiError = err?.response?.candidates?.[0]?.finishReason === 'SAFETY' 
      ? 'O conteúdo foi bloqueado pelos filtros de segurança da IA.' 
      : (err.message || 'Falha ao processar o relatório via IA.');
    throw new Error(apiError);
  }
}
