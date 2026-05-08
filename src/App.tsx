import { useState, useRef, useEffect } from 'react';
import { Mic, Square, FileText, Copy, Check, Loader2, School, AlertCircle, Trash2, Printer, History, Save, X, Search, Calendar, Upload, FileAudio, ChevronLeft, FileDown, Loader } from 'lucide-react';
import { generateReport } from './services/geminiService';
import { jsPDF } from 'jspdf';
import { supabase } from './lib/supabase';

const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

interface SavedReport {
  id: string;
  date: string;
  studentName: string;
  studentClass: string;
  content: string;
}

export default function App() {
  const [transcript, setTranscript] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [reportText, setReportText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  const [history, setHistory] = useState<SavedReport[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSaved, setIsSaved] = useState(false);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [selectedStudentForHistory, setSelectedStudentForHistory] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const recognitionRef = useRef<any>(null);

  // Monitoramento de alterações não salvas para o aviso de saída
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = ''; // Padrão necessário para navegadores modernos exibirem o aviso
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Sempre que o texto do relatório mudar (via IA ou edição manual), marcamos como não salvo
  useEffect(() => {
    if (reportText && !isSaved) {
      setHasUnsavedChanges(true);
    }
  }, [reportText]);

  // Carregar histórico do Supabase
  const loadSupabaseHistory = async () => {
    if (!supabase) {
      console.warn('Supabase não configurado. Histórico no banco de dados desabilitado.');
      return;
    }
    
    setIsHistoryLoading(true);
    try {
      const { data, error } = await supabase
        .from('reports')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data) {
        const transformed: SavedReport[] = data.map(item => ({
          id: item.id,
          date: item.created_at,
          studentName: item.student_name,
          studentClass: item.student_class,
          content: item.content
        }));
        setHistory(transformed);
      }
    } catch (err) {
      console.error('Erro ao carregar histórico:', err);
      setErrorMsg('Não foi possível carregar o histórico do banco de dados.');
    } finally {
      setIsHistoryLoading(false);
    }
  };

  useEffect(() => {
    loadSupabaseHistory();
  }, []);

  useEffect(() => {
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'pt-BR';
      
      recognition.onresult = (event: any) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript + ' ';
          }
        }
        if (finalTranscript) {
          setTranscript((prev) => prev + finalTranscript);
        }
      };

      recognition.onerror = (event: any) => {
        console.error("Speech recognition error", event.error);
        setIsRecording(false);
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognitionRef.current = recognition;
    }
  }, []);

  const toggleRecording = () => {
    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
    } else {
      if (!SpeechRecognition) {
        setErrorMsg('Microfone (voz-para-texto) não suportado pelo seu navegador. Por favor, digite manualmente.');
        return;
      }
      setErrorMsg('');
      try {
        recognitionRef.current?.start();
        setIsRecording(true);
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type.startsWith('audio/')) {
        setAudioFile(file);
        setErrorMsg('');
      } else {
        setErrorMsg('Por favor, selecione um arquivo de áudio válido.');
      }
    }
  };

  const handleRemoveAudio = () => {
    setAudioFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleGenerateReport = async () => {
    if (!transcript.trim() && !audioFile) {
      setErrorMsg('Por favor, informe um relato, grave o áudio ou faça upload de um arquivo de áudio antes de gerar o relatório.');
      return;
    }
    setErrorMsg('');
    setIsGenerating(true);
    try {
      if (isRecording) {
        recognitionRef.current?.stop();
        setIsRecording(false);
      }
      
      let audioData;
      if (audioFile) {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
             const result = reader.result as string;
             resolve(result.split(',')[1]);
          };
          reader.onerror = reject;
          reader.readAsDataURL(audioFile);
        });
        audioData = { base64, mimeType: audioFile.type || 'audio/mp3' };
      }

      const data = await generateReport(transcript, audioData);
      setReportText(data);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao comunicar com a IA.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = async () => {
    if (!reportText) return;
    try {
      await navigator.clipboard.writeText(reportText);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text', err);
    }
  };

  const handleSaveReport = async () => {
    if (!reportText) return;
    
    if (!supabase) {
      setErrorMsg('O banco de dados não está configurado. Verifique as chaves VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.');
      return;
    }

    const matchName = reportText.match(/ESTUDANTE \(A\):\s*(.*?)(?=\s*IDADE:|$|\n)/i);
    const name = matchName && matchName[1] && matchName[1].trim() !== '__________________' 
      ? matchName[1].trim() 
      : 'Não identificado';

    const matchClass = reportText.match(/TURMA:\s*(.*?)(?=\s*TURNO:|$|\n)/i);
    const studentClass = matchClass && matchClass[1] && matchClass[1].trim() !== '__________________' 
      ? matchClass[1].trim() 
      : 'Não identificada';

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('reports')
        .insert({
          student_name: name,
          student_class: studentClass,
          content: reportText
        });

      if (error) throw error;

      // Recarregar histórico após salvar
      await loadSupabaseHistory();

      setHasUnsavedChanges(false);
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2000);
      
      setTranscript('');
      setAudioFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      console.error('Erro ao salvar:', err);
      setErrorMsg('Falha ao salvar no banco de dados Supabase.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteHistory = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!supabase) {
      setErrorMsg('Erro: Cliente de banco de dados não disponível.');
      return;
    }

    if (window.confirm('Tem certeza que deseja excluir este relatório permanentemente do banco de dados?')) {
      try {
        const { error } = await supabase
          .from('reports')
          .delete()
          .eq('id', id);

        if (error) throw error;
        
        setHistory(history.filter(r => r.id !== id));
      } catch (err) {
        console.error('Erro ao deletar:', err);
        setErrorMsg('Não foi possível excluir o relatório.');
      }
    }
  };

  const handleLoadHistory = (report: SavedReport) => {
    if (hasUnsavedChanges) {
      if (!window.confirm('Você tem alterações não salvas no relatório atual. Deseja descartá-las e carregar este registro do histórico?')) {
        return;
      }
    }
    setTranscript('');
    setAudioFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setReportText(report.content);
    setIsHistoryOpen(false);
    // Como estamos carregando algo já existente, não marcamos como dirty imediatamente
    setTimeout(() => setHasUnsavedChanges(false), 0);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportPDF = () => {
    if (!reportText) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    const maxLineWidth = pageWidth - margin * 2;

    // Cabeçalho
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("ESCOLA ESTADUAL FREDERICO J. P. NETO", pageWidth / 2, 20, { align: "center" });
    
    doc.setFontSize(12);
    doc.text("RELATÓRIO TÉCNICO – EQUIPE MULTIPROFISSIONAL", pageWidth / 2, 30, { align: "center" });
    
    doc.setLineWidth(0.5);
    doc.line(margin, 35, pageWidth - margin, 35);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);

    // Processar o texto para o PDF
    const lines = doc.splitTextToSize(reportText, maxLineWidth);
    let y = 45;
    const lineHeight = 7;
    const pageHeight = doc.internal.pageSize.getHeight();

    lines.forEach((line: string) => {
      // Verificar se o texto é um título de seção (ex: I - IDENTIFICAÇÃO)
      if (/^[I|V|X]+ – /.test(line) || /^[V]+ – /.test(line)) {
        doc.setFont("helvetica", "bold");
      } else {
        doc.setFont("helvetica", "normal");
      }

      if (y > pageHeight - margin) {
        doc.addPage();
        y = 20;
      }
      
      doc.text(line, margin, y);
      y += lineHeight;
    });

    // Nome do arquivo baseado no estudante
    const matchName = reportText.match(/Nome do estudante:\s*(.*?)(?=\n|$)/);
    let fileName = "Relatorio_Tecnico";
    if (matchName && matchName[1] && matchName[1].trim() !== '__________________') {
      fileName = `Relatorio_${matchName[1].trim().replace(/\s+/g, '_')}`;
    }
    
    doc.save(`${fileName}.pdf`);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans p-4 sm:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Cabeçalho - Oculto na impressão */}
        <header className="print:hidden bg-emerald-800 text-white rounded-2xl p-6 md:p-8 shadow-lg flex flex-col md:flex-row items-center gap-6 justify-between">
          <div className="flex flex-col md:flex-row items-center gap-6 text-center md:text-left">
            <div className="bg-emerald-700 p-4 rounded-xl shadow-inner shrink-0 mx-auto md:mx-0">
              <School size={48} className="text-emerald-100" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Escola Estadual Frederico J. P. Neto</h1>
              <p className="text-emerald-100 mt-2 text-lg">Sistema de Apoio Pedagógico e Orientação Educacional</p>
            </div>
          </div>
          <button
            onClick={() => {
              setIsHistoryOpen(true);
              setSelectedStudentForHistory(null);
              setSearchTerm('');
            }}
            className="flex items-center gap-2 bg-emerald-700 hover:bg-emerald-600 px-5 py-3 rounded-xl transition-colors font-medium border border-emerald-600 shadow-sm shrink-0 whitespace-nowrap"
          >
            <History size={20} /> Histórico ({history.length})
          </button>
        </header>

        {errorMsg && (
          <div className="print:hidden bg-red-50 border-l-4 border-red-500 text-red-700 p-4 rounded shadow-sm flex items-start gap-3">
            <AlertCircle className="shrink-0 mt-0.5" size={20} />
            <p>{errorMsg}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Seção Esquerda: Entrada de Dados - Oculta na impressão */}
          <div className="print:hidden lg:col-span-5 flex flex-col gap-6">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col h-full">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-slate-700 flex items-center gap-2">
                  <Mic size={20} className="text-emerald-600" />
                  Relato do Atendimento
                </h2>
                {transcript && (
                  <button 
                    onClick={() => setTranscript('')} 
                    className="text-slate-400 hover:text-red-500 transition-colors"
                    title="Limpar texto"
                  >
                    <Trash2 size={18} />
                  </button>
                )}
              </div>

              <p className="text-sm text-slate-500 mb-4">
                Grave via microfone, faça upload de um áudio salvo, ou cole as anotações do atendimento para converter no formulário técnico oficial.
              </p>

              <textarea
                className="w-full flex-grow min-h-[200px] p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-shadow resize-none text-slate-700 mb-4"
                placeholder="Exemplo: Atendi a Yasmin do 7º ano tarde, que estava muito agitada em sala..."
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
              />

              {audioFile && (
                <div className="flex items-center justify-between p-3 bg-emerald-50 border border-emerald-200 rounded-xl mb-4">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <FileAudio size={20} className="text-emerald-600 shrink-0" />
                    <span className="text-sm font-medium text-emerald-800 truncate" title={audioFile.name}>
                      {audioFile.name}
                    </span>
                  </div>
                  <button
                    onClick={handleRemoveAudio}
                    className="p-1 hover:bg-emerald-100 rounded-full text-emerald-600 transition-colors"
                    title="Remover áudio"
                  >
                    <X size={16} />
                  </button>
                </div>
              )}

              <input
                type="file"
                accept="audio/*"
                className="hidden"
                ref={fileInputRef}
                onChange={handleFileUpload}
              />

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium transition-all flex-1 bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200"
                >
                  <Upload size={18} /> Upload de Áudio
                </button>

                <button
                  onClick={toggleRecording}
                  className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium transition-all flex-1 ${
                    isRecording 
                      ? 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100'
                      : 'bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200'
                  }`}
                >
                  {isRecording ? (
                    <>
                      <Square size={18} className="animate-pulse fill-current" /> Parando...
                    </>
                  ) : (
                    <>
                      <Mic size={18} /> Gravar Áudio
                    </>
                  )}
                </button>
              </div>

              <div className="mt-4 pt-4 border-t border-slate-100">
                <button
                  onClick={handleGenerateReport}
                  disabled={isGenerating || (!transcript.trim() && !audioFile)}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-medium text-white transition-all bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 size={18} className="animate-spin" /> Processando...
                    </>
                  ) : (
                    <>
                      <FileText size={18} /> Gerar Relatório
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Seção Direita: Documento Gerado */}
          <div className="lg:col-span-7 flex flex-col h-full print:col-span-12">
            <div className="bg-white rounded-2xl shadow-sm border border-emerald-100 p-6 md:p-8 flex flex-col h-full">
              
              <div className="print:hidden flex flex-wrap items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-100">
                <div className="flex flex-col">
                  <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                    <FileText size={24} className="text-emerald-600" />
                    Relatório Técnico
                  </h2>
                  {reportText && (
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded mt-1 w-fit ${hasUnsavedChanges ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                      {hasUnsavedChanges ? '● Alterações não salvas' : '✓ Salvo no histórico'}
                    </span>
                  )}
                </div>
                
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={handleSaveReport}
                    disabled={!reportText || isSaving}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {isSaving ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      isSaved ? <Check size={16} className="text-emerald-600" /> : <Save size={16} />
                    )}
                    {isSaving ? 'Salvando...' : (isSaved ? 'Salvo!' : 'Salvar')}
                  </button>
                  <button
                    onClick={handlePrint}
                    disabled={!reportText}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <Printer size={16} /> Imprimir
                  </button>
                  <button
                    onClick={handleExportPDF}
                    disabled={!reportText}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-emerald-600 bg-emerald-50 hover:bg-emerald-100 border border-emerald-100 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <FileDown size={16} /> Exportar PDF
                  </button>
                  <button
                    onClick={handleCopy}
                    disabled={!reportText}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-slate-700 hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {isCopied ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
                    {isCopied ? 'Copiado!' : 'Copiar Texto'}
                  </button>
                </div>
              </div>

              {/* Título Visível Apenas na Impressão Para Formalidade */}
              <div className="hidden print:block text-center space-y-2 mb-8 border-b-2 border-black pb-4">
                <h1 className="text-xl font-bold uppercase tracking-wider">Escola Estadual Frederico J. P. Neto</h1>
                <h2 className="text-lg font-bold">RELATÓRIO TÉCNICO – EQUIPE MULTIPROFISSIONAL</h2>
              </div>

              {reportText ? (
                <div className="relative flex-grow flex flex-col">
                  <div className="print:hidden absolute -top-2 right-0 flex items-center gap-1 text-[10px] text-slate-400 font-medium bg-white px-2 italic">
                    Clique no texto para editar manualmente
                  </div>
                  <textarea 
                    className="w-full flex-grow min-h-[500px] border-none bg-transparent resize-none outline-none font-serif text-[15px] leading-relaxed text-slate-900 print:text-black focus:ring-0 pt-4"
                    value={reportText}
                    onChange={(e) => setReportText(e.target.value)}
                    spellCheck={false}
                  />
                </div>
              ) : (
                <div className="print:hidden w-full h-full min-h-[400px] flex flex-col items-center justify-center text-slate-400 gap-4 text-center">
                  <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center">
                    <FileText size={32} className="text-slate-300" />
                  </div>
                  <p>O relatório estruturado e preenchido<br/>aparecerá aqui para edição e cópia.</p>
                </div>
              )}
            </div>
          </div>
          
        </div>
      </div>

      {/* Overlay do Histórico */}
      {isHistoryOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex justify-end">
          <div className="w-full max-w-sm sm:max-w-md bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right-8 duration-300">
            <div className="p-5 sm:p-6 border-b border-emerald-900/10 flex items-center justify-between bg-emerald-800 text-white">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <History size={24} /> Histórico
              </h2>
              <button onClick={() => setIsHistoryOpen(false)} className="p-2 hover:bg-emerald-700 rounded-full transition-colors text-emerald-100 hover:text-white">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-4 border-b border-slate-100 bg-slate-50 shrink-0">
              <div className="relative">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar por nome ou turma..."
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-shadow text-sm"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50">
              {!supabase ? (
                <div className="text-center text-slate-500 py-10 flex flex-col items-center gap-3">
                  <div className="bg-amber-50 p-4 rounded-full">
                    <AlertCircle size={24} className="text-amber-600" />
                  </div>
                  <p className="font-medium text-amber-800">Banco de dados não configurado</p>
                  <p className="text-xs px-6">Adicione as variáveis de ambiente Supabase para habilitar o armazenamento em nuvem.</p>
                </div>
              ) : isHistoryLoading ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
                  <Loader className="animate-spin" size={32} />
                  <p className="text-sm">Carregando do banco de dados Cloud...</p>
                </div>
              ) : (() => {
                if (selectedStudentForHistory) {
                  const studentReports = history.filter(r => 
                    r.studentName === selectedStudentForHistory &&
                    (r.content.toLowerCase().includes(searchTerm.toLowerCase()) || 
                     new Date(r.date).toLocaleDateString('pt-BR').includes(searchTerm))
                  );
                  
                  return (
                    <>
                      <div className="flex items-center gap-3 mb-4 p-2 bg-emerald-50 rounded-xl border border-emerald-100">
                        <button 
                          onClick={() => {
                            setSelectedStudentForHistory(null);
                            setSearchTerm('');
                          }} 
                          className="flex items-center gap-1 px-3 py-1.5 bg-white hover:bg-emerald-100 text-emerald-700 rounded-lg text-sm font-bold shadow-sm transition-colors border border-emerald-200"
                        >
                          <ChevronLeft size={16} /> Voltar
                        </button>
                        <div className="font-bold text-emerald-900 flex-1 truncate text-sm">
                          {selectedStudentForHistory}
                        </div>
                      </div>
                      
                      {studentReports.length > 0 ? (
                        studentReports.map((report) => (
                          <div 
                            key={report.id}
                            onClick={() => handleLoadHistory(report)}
                            className="p-4 bg-white border border-slate-200 rounded-xl hover:border-emerald-500 hover:shadow-md cursor-pointer transition-all group relative"
                          >
                            <button 
                              onClick={(e) => handleDeleteHistory(report.id, e)}
                              className="absolute top-3 right-3 p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg sm:opacity-0 sm:group-hover:opacity-100 transition-all z-10"
                              title="Excluir"
                            >
                              <Trash2 size={16} />
                            </button>
                            
                            <div className="text-sm text-slate-500 flex flex-col gap-1.5 pr-8">
                              <span className="flex items-center gap-1.5 font-bold text-slate-700">
                                <Calendar size={14} className="text-emerald-600" /> 
                                {new Date(report.date).toLocaleDateString('pt-BR')} às {new Date(report.date).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}
                              </span>
                              <span className="text-xs text-slate-400 line-clamp-2 mt-1">
                                {report.content.substring(0, 150).replace(/[#*]/g, '')}...
                              </span>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center text-slate-500 py-10 text-sm italic">
                          Nenhum registro encontrado para este critério.
                        </div>
                      )}
                    </>
                  );
                }

                // Group by student
                const groupedHistory = history.reduce((acc, report) => {
                  if (!acc[report.studentName]) {
                    acc[report.studentName] = { 
                      studentName: report.studentName, 
                      studentClass: report.studentClass,
                      reports: [] 
                    };
                  }
                  acc[report.studentName].reports.push(report);
                  return acc;
                }, {} as Record<string, { studentName: string, studentClass: string, reports: SavedReport[] }>);

                const filteredStudents = Object.values(groupedHistory).filter(group => 
                  group.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                  group.studentClass.toLowerCase().includes(searchTerm.toLowerCase())
                );

                if (history.length === 0) {
                  return (
                    <div className="text-center text-slate-500 py-10 flex flex-col items-center gap-3">
                      <div className="bg-slate-100 p-4 rounded-full">
                        <History size={24} className="text-slate-400" />
                      </div>
                      <p>Nenhum relatório salvo ainda.</p>
                    </div>
                  );
                }

                if (filteredStudents.length === 0) {
                  return (
                    <div className="text-center text-slate-500 py-10">Nenhum aluno encontrado.</div>
                  );
                }

                return filteredStudents.map((group) => (
                  <div 
                    key={group.studentName}
                    onClick={() => setSelectedStudentForHistory(group.studentName)}
                    className="p-4 bg-white border border-slate-200 rounded-xl hover:border-emerald-500 hover:shadow-md cursor-pointer transition-all flex items-center justify-between"
                  >
                    <div className="flex-1 min-w-0 pr-4">
                      <h3 className="font-bold text-slate-800 mb-1 leading-tight truncate">{group.studentName}</h3>
                      <div className="flex items-center gap-1.5 text-sm text-slate-500">
                        <School size={14} className="text-emerald-600 shrink-0" /> 
                        <span className="truncate">{group.studentClass}</span>
                      </div>
                    </div>
                    <div className="bg-emerald-100 text-emerald-800 text-xs font-bold px-2.5 py-1 rounded-full shrink-0">
                      {group.reports.length} {group.reports.length === 1 ? 'relatório' : 'relatórios'}
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
