// Configurações da API
// Firebase auth e db são inicializados em firebase-init.js e estão disponíveis globalmente.
// ATENÇÃO: Esta URL deve ser configurada para o ambiente de produção.
const API_URL = 'http://localhost:5678/webhook-test/fd061969-eb2c-4355-89da-910ec299d4ef';

// Elementos DOM
const elementos = {
    tipoDiscurso: document.getElementById('tipoDiscurso'),
    tema: document.getElementById('tema'),
    tempo: document.getElementById('tempo'),
    informacoesAdicionais: document.getElementById('informacoesAdicionais'),
    versiculosOpicionais: document.getElementById('versiculosOpicionais'),
    topicosOpicionais: document.getElementById('topicosOpicionais'),
    loading: document.getElementById('loading'),
    resultSection: document.getElementById('resultSection'),
    errorMessage: document.getElementById('errorMessage'),
    resultTitle: document.getElementById('resultTitle'),
    resultType: document.getElementById('resultType'),
    pontosList: document.getElementById('pontosList'),
    referenciasList: document.getElementById('referenciasList'),
    userInfo: document.getElementById('userInfo'),
    historicoList: document.getElementById('historicoList'),
    sidebar: document.getElementById('sidebar'),
    btnDownload: document.getElementById('btnDownload')
};

// Classe principal da aplicação
class GeradorEsboco {
    constructor() {
        this.usuarioAtual = null;
        this.inicializar();
        this.docIdEmEdicao = null;
        this.idEsbocoExibido = null; // Adicionado para armazenar o ID do esboço exibido
    }

    inicializar() {
        this.configurarEventListeners();
        this.configurarAuthStateListener();
        // Adicionar listener para busca no histórico
        const buscaInput = document.getElementById('buscaHistorico');
        if (buscaInput) {
            buscaInput.addEventListener('input', (e) => {
                this.filtrarHistorico(e.target.value);
            });
        }
    }

    // Configurar listeners de eventos
    configurarEventListeners() {
        // Evento para gerar esboço ao pressionar Enter
        elementos.tema?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.gerarEsboco();
        });

        // Esconder elementos quando mudar tipo de discurso
        elementos.tipoDiscurso?.addEventListener('change', () => {
            this.esconderElementos();
        });

        // Esconder mensagem de erro ao digitar
        elementos.tema?.addEventListener('input', () => {
            if (elementos.errorMessage?.style.display === 'block') {
                elementos.errorMessage.style.display = 'none';
            }
        });
    }

    // Configurar listener de autenticação
    configurarAuthStateListener() {
        auth.onAuthStateChanged(async (user) => {
            this.usuarioAtual = user;
            
            if (user) {
                await this.carregarDadosUsuario(user);
            } else {
                this.redirecionarParaLogin();
            }
        });
    }

    // Carregar dados do usuário
    async carregarDadosUsuario(user) {
        try {
            const nomeUsuario = user.displayName || user.email || "Usuário";
            
            if (elementos.userInfo) {
                elementos.userInfo.textContent = `👤 Usuário: ${nomeUsuario}`;
            }

            await this.carregarHistorico(user.uid);
        } catch (error) {
            console.error("Erro ao carregar dados do usuário:", error);
            this.mostrarErro("Erro ao carregar dados do usuário");
        }
    }

    // Carregar histórico do usuário - VERSÃO CORRIGIDA
    async carregarHistorico(uid) {
        if (!elementos.historicoList) {
            console.warn("Elemento historicoList não encontrado");
            return;
        }

        try {
            elementos.historicoList.innerHTML = '<li>Carregando histórico...</li>';

            // Verificar se a coleção existe e se temos permissão
            console.log("Tentando carregar histórico para UID:", uid);

            // ATENÇÃO: Para que orderBy("criadoEm", "desc") funcione eficientemente
            // e sem erros em produção, um índice composto em (uid, criadoEm DESC)
            // deve ser criado no Firestore para a coleção "esbocos".
            // O Firebase geralmente sugere o link para criação no console quando detecta a necessidade.
            // Removendo o fallback complexo, assumindo que o índice será criado.
            const query = db.collection("esbocos")
                .where("uid", "==", uid)
                .orderBy("criadoEm", "desc")
                .limit(10);
            
            const snapshot = await query.get();
            console.log("Query de histórico executada:", snapshot.size, "documentos");
            
            this.processarHistorico(snapshot);

        } catch (error) {
            console.error("Erro detalhado ao carregar histórico:", error);
            // O erro pode ser devido à ausência do índice mencionado acima.
            console.error("Código do erro:", error.code);
            console.error("Mensagem do erro:", error.message);
            
            // Mostrar erro mais específico
            let mensagemErro = "Erro ao carregar histórico.";
            
            if (error.code === 'permission-denied') {
                mensagemErro = "Permissão negada para acessar o histórico.";
            } else if (error.code === 'failed-precondition') {
                mensagemErro = "Índice necessário não encontrado no Firestore.";
            } else if (error.code === 'unavailable') {
                mensagemErro = "Serviço temporariamente indisponível.";
            }
            
            elementos.historicoList.innerHTML = `<li style="color: red;">${mensagemErro}</li>`;
        }
    }

    // Armazenar docs do histórico para busca
    _docsHistorico = [];

    // Processar dados do histórico
    processarHistorico(snapshot) {
        elementos.historicoList.innerHTML = '';
        this._docsHistorico = [];

        if (snapshot.empty) {
            elementos.historicoList.innerHTML = '<li>Você ainda não gerou esboços.</li>';
            return;
        }

        // Converter para array e ordenar manualmente se necessário
        const docs = [];
        snapshot.forEach(doc => {
            docs.push({ id: doc.id, data: doc.data() });
        });
        this._docsHistorico = docs;
        this.renderizarHistorico(docs);
    }

    // Renderizar lista do histórico (usado para busca)
    renderizarHistorico(docs) {
        elementos.historicoList.innerHTML = '';
        // Ordenar: favoritos no topo, depois por data
        docs.sort((a, b) => {
            if ((b.data.favorito ? 1 : 0) !== (a.data.favorito ? 1 : 0)) {
                return (b.data.favorito ? 1 : 0) - (a.data.favorito ? 1 : 0);
            }
            const dateA = a.data.criadoEm?.toDate() || new Date(0);
            const dateB = b.data.criadoEm?.toDate() || new Date(0);
            return dateB - dateA;
        });
        docs.forEach(({ id, data }) => {
            try {
                const li = document.createElement('li');
                li.style.cssText = `
                    cursor: pointer;
                    padding: 8px;
                    margin: 4px 0;
                    border-left: 3px solid #4a90e2;
                    background: #f9f9f9;
                    border-radius: 4px;
                    transition: background-color 0.2s;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                `;
                const star = document.createElement('span');
                star.innerHTML = data.favorito ? '⭐' : '☆';
                star.title = data.favorito ? 'Remover dos favoritos' : 'Adicionar aos favoritos';
                star.style.cssText = 'font-size: 1.3em; margin-right: 10px; cursor: pointer; user-select: none;';
                star.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.toggleFavorito(id, data.favorito);
                });
                const info = document.createElement('div');
                info.innerHTML = `
                    <strong>${this.formatarTipoDiscurso(data.tipoDiscurso) || 'Tipo não especificado'}</strong><br>
                    <span style="font-size: 0.9em;">${data.tema || 'Sem tema'}</span><br>
                    <small style="color: #666;">${data.criadoEm?.toDate()?.toLocaleString('pt-BR', {
                        year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
                    }) || 'Data não disponível'}</small>
                `;
                info.style.flex = '1';
                li.appendChild(info);
                li.appendChild(star);
                li.addEventListener('mouseenter', () => {
                    li.style.backgroundColor = '#e8f4f8';
                });
                li.addEventListener('mouseleave', () => {
                    li.style.backgroundColor = '#f9f9f9';
                });
                // Clique abre modal detalhado
                li.addEventListener('click', () => this.abrirModalDetalheEsboco(data, id));
                // Edição ao clicar com botão direito
                li.addEventListener('contextmenu', (e) => {
                    e.preventDefault();
                    this.abrirModalEdicao(id, data);
                });
                elementos.historicoList.appendChild(li);
            } catch (itemError) {
                console.error("Erro ao processar item do histórico:", itemError);
            }
        });
        if (docs.length === 0) {
            elementos.historicoList.innerHTML = '<li>Nenhum esboço encontrado.</li>';
        }
    }

    // Filtrar histórico pelo campo de busca
    filtrarHistorico(termo) {
        termo = (termo || '').toLowerCase();
        if (!termo) {
            this.renderizarHistorico(this._docsHistorico);
            return;
        }
        const filtrados = this._docsHistorico.filter(({ data }) => {
            const tema = (data.tema || '').toLowerCase();
            const tipo = (this.formatarTipoDiscurso(data.tipoDiscurso) || '').toLowerCase();
            const dataStr = data.criadoEm?.toDate()?.toLocaleString('pt-BR') || '';
            return tema.includes(termo) || tipo.includes(termo) || dataStr.includes(termo);
        });
        this.renderizarHistorico(filtrados);
    }

    // Formatar tipo de discurso para exibição
    formatarTipoDiscurso(tipo) {
        const tipos = {
            'estudante': 'Estudante',
            'anciao': 'Ancião',
            'servo': 'Servo Ministerial',
            'publico': 'Discurso Público',
            'assembleia': 'Assembleia'
        };
        return tipos[tipo] || tipo;
    }

    // Carregar esboço do histórico
    async carregarEsbocoDoHistorico(docId) {
        try {
            console.log("Carregando esboço do histórico:", docId);
            
            const doc = await db.collection("esbocos").doc(docId).get();
            
            if (doc.exists) {
                const data = doc.data();
                console.log("Dados do esboço carregado:", data);
                
                // Verificar se o conteúdo existe
                if (data.conteudo) {
                    this.mostrarResultado({ output: data.conteudo }, docId);
                    this.fecharMenu();
                    this.mostrarNotificacao('Esboço carregado do histórico!');
                } else {
                    this.mostrarErro('Conteúdo do esboço não encontrado.');
                }
            } else {
                this.mostrarErro('Esboço não encontrado no histórico.');
            }
        } catch (error) {
            console.error("Erro ao carregar esboço do histórico:", error);
            this.mostrarErro("Erro ao carregar esboço do histórico: " + error.message);
        }
    }

    // Função principal para gerar esboço
    async gerarEsboco() {
        const dadosFormulario = this.obterDadosFormulario();
        
        if (!this.validarDados(dadosFormulario)) {
            return;
        }

        this.mostrarCarregamento(true);
        this.esconderElementos();

        try {
            const response = await this.enviarRequisicao(dadosFormulario);
            const data = await response.json();
            
            console.log('Resposta do servidor:', data);

            if (!data || typeof data !== 'object') {
                throw new Error('Resposta inválida do servidor');
            }

            await this.salvarEsbocoNoFirestore(dadosFormulario, data);
            this.mostrarResultado(data);
            
            if (elementos.btnDownload) {
                elementos.btnDownload.style.display = 'inline-block';
            }

        } catch (error) {
            console.error('Erro ao gerar esboço:', error);
            this.mostrarErro(`Erro ao gerar esboço: ${error.message}`);
        } finally {
            this.mostrarCarregamento(false);
        }
    }

    // Obter dados do formulário
    obterDadosFormulario() {
        return {
            tipoDiscurso: elementos.tipoDiscurso?.value || '',
            tempo: elementos.tempo?.value?.trim() || '',
            tema: elementos.tema?.value?.trim() || '',
            informacoesAdicionais: elementos.informacoesAdicionais?.value?.trim() || '',
            versiculosOpicionais: elementos.versiculosOpicionais?.value?.trim() || '',
            topicosOpicionais: elementos.topicosOpicionais?.value?.trim() || ''
        };
    }

    // Validar dados do formulário
    validarDados(dados) {
        if (!dados.tipoDiscurso) {
            this.mostrarAlerta('Por favor, selecione o tipo de discurso!');
            return false;
        }
        
        if (!dados.tema) {
            this.mostrarAlerta('Por favor, insira o tema do discurso!');
            return false;
        }
        
        if (dados.tipoDiscurso === 'publico') {
            this.mostrarAlerta('Ferramenta disponível em breve. Por favor, escolha outro tipo de discurso.');
            return false;
        }

        return true;
    }

    // Enviar requisição para API
    async enviarRequisicao(dados) {
        const temaFormatado = encodeURIComponent(dados.tema);
        
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                tipo_discurso: dados.tipoDiscurso,
                tempo: dados.tempo,
                tema: temaFormatado,
                informacoes_adicionais: dados.informacoesAdicionais,
                versiculos_opicionais: dados.versiculosOpicionais,
                topicos_opicionais: dados.topicosOpicionais
            })
        });

        if (!response.ok) {
            throw new Error(`Erro HTTP: ${response.status} - ${response.statusText}`);
        }

        return response;
    }

    // Salvar esboço no Firestore - VERSÃO MELHORADA
    async salvarEsbocoNoFirestore(dadosFormulario, resultado) {
        if (!this.usuarioAtual) {
            console.warn("Usuário não autenticado, não é possível salvar");
            return;
        }

        try {
            const texto = Array.isArray(resultado) ? resultado[0].output : resultado.output;
            
            if (!texto) {
                console.warn("Conteúdo vazio, não será salvo");
                return;
            }

            const docData = {
                uid: this.usuarioAtual.uid,
                tipoDiscurso: dadosFormulario.tipoDiscurso,
                tempo: dadosFormulario.tempo,
                tema: dadosFormulario.tema,
                informacoesAdicionais: dadosFormulario.informacoesAdicionais || '',
                versiculosOpicionais: dadosFormulario.versiculosOpicionais || '',
                topicosOpicionais: dadosFormulario.topicosOpicionais || '',
                conteudo: texto,
                criadoEm: firebase.firestore.FieldValue.serverTimestamp(),
                favorito: false // Novo campo para favoritos
            };

            console.log("Salvando esboço no Firestore:", docData);
            
            const docRef = await db.collection("esbocos").add(docData);
            this.ultimoEsbocoIdGerado = docRef.id;
            this.idEsbocoExibido = docRef.id; // Salva o ID do esboço exibido
            console.log("Esboço salvo com ID:", docRef.id);

            // Recarregar histórico após salvar
            await this.carregarHistorico(this.usuarioAtual.uid);
            
            this.mostrarNotificacao('Esboço salvo com sucesso!');
            
        } catch (error) {
            console.error("Erro ao salvar esboço:", error);
            console.error("Código do erro:", error.code);
            console.error("Mensagem do erro:", error.message);
            
            // Não mostrar erro para o usuário se for apenas problema de salvamento
            // O esboço ainda será exibido
        }
    }

    // Mostrar resultado
    mostrarResultado(esboco, esbocoId = null) {
        try {
            const texto = Array.isArray(esboco) ? esboco[0].output : esboco.output;
            // Salva o ID do esboço atualmente exibido
            this.idEsbocoExibido = esbocoId || this.ultimoEsbocoIdGerado || null;
            if (!texto) {
                throw new Error('Esboço sem conteúdo');
            }

            if (elementos.resultTitle) {
                elementos.resultTitle.textContent = 'Esboço Gerado';
            }
            
            if (elementos.resultType) {
                elementos.resultType.textContent = 'Discurso Personalizado';
            }

            if (elementos.pontosList) {
                elementos.pontosList.innerHTML = '';
            }

            if (elementos.referenciasList) {
                elementos.referenciasList.innerHTML = '';

                const pre = document.createElement('pre');
                pre.innerHTML = this.formatarNegrito(texto);
                pre.style.cssText = `
                    white-space: pre-wrap;
                    font-family: inherit;
                    line-height: 1.6;
                    background: #f9f9f9;
                    padding: 15px;
                    border-radius: 8px;
                    margin: 0;
                `;

                elementos.referenciasList.appendChild(pre);
            }

            if (elementos.resultSection) {
                elementos.resultSection.style.display = 'block';
                elementos.resultSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }

            // Compartilhamento
            this.configurarBotoesCompartilhamento(texto);

        } catch (error) {
            console.error('Erro ao processar resultado:', error);
            this.mostrarErro('Erro ao processar os dados recebidos');
        }
    }

    configurarBotoesCompartilhamento(texto) {
        // E-mail
        const btnEmail = document.getElementById('btnCompartilharEmail');
        if (btnEmail) {
            btnEmail.onclick = () => {
                const assunto = encodeURIComponent('Esboço Gerado');
                const corpo = encodeURIComponent(texto);
                window.open(`mailto:?subject=${assunto}&body=${corpo}`);
            };
        }
        // WhatsApp
        const btnWhats = document.getElementById('btnCompartilharWhats');
        if (btnWhats) {
            btnWhats.onclick = () => {
                const msg = encodeURIComponent(texto);
                window.open(`https://wa.me/?text=${msg}`);
            };
        }
        // Link compartilhável (copia para área de transferência)
        const btnLink = document.getElementById('btnCompartilharLink');
        if (btnLink) {
            btnLink.onclick = async () => {
                try {
                    let id = this.idEsbocoExibido || this.ultimoEsbocoIdGerado || null;
                    let url = window.location.origin + window.location.pathname;
                    if (id) {
                        url = window.location.origin + '/esboco.html?id=' + id;
                        await navigator.clipboard.writeText(url);
                        this.mostrarNotificacao('Link público copiado!');
                    } else {
                        await navigator.clipboard.writeText(texto);
                        this.mostrarNotificacao('Texto copiado!');
                    }
                } catch (err) {
                    this.mostrarErro('Erro ao copiar link/texto.');
                }
            };
        }
    }

    // Formatar texto em negrito
    formatarNegrito(texto) {
        return texto.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    }

    // Mostrar/esconder carregamento
    mostrarCarregamento(mostrar) {
        if (elementos.loading) {
            elementos.loading.style.display = mostrar ? 'block' : 'none';
        }

        const botao = document.querySelector('.btn');
        if (botao) {
            botao.disabled = mostrar;
            botao.textContent = mostrar ? '⏳ Gerando...' : '🔍 Gerar Esboço';
        }
    }

    // Esconder elementos
    esconderElementos() {
        if (elementos.resultSection) {
            elementos.resultSection.style.display = 'none';
        }
        if (elementos.errorMessage) {
            elementos.errorMessage.style.display = 'none';
        }
        if (elementos.btnDownload) {
            elementos.btnDownload.style.display = 'none';
        }
    }

    // Mostrar erro
    mostrarErro(mensagem) {
        if (elementos.errorMessage) {
            elementos.errorMessage.textContent = mensagem;
            elementos.errorMessage.style.display = 'block';
            elementos.errorMessage.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    // Mostrar alerta
    mostrarAlerta(mensagem) {
        alert(mensagem);
    }

    // Redirecionar para login
    redirecionarParaLogin() {
        window.location.href = "login.html";
    }

    // Abrir menu lateral
    abrirMenu() {
        if (elementos.sidebar) {
            elementos.sidebar.style.width = "300px";
        }
    }

    // Fechar menu lateral
    fecharMenu() {
        if (elementos.sidebar) {
            elementos.sidebar.style.width = "0";
        }
    }

    // Logout
    async logout() {
        try {
            await auth.signOut();
            window.location.href = 'login.html';
        } catch (error) {
            console.error('Erro ao sair:', error);
            this.mostrarErro('Erro ao fazer logout');
        }
    }

    // Copiar texto para clipboard
    async copiarTexto(texto) {
        try {
            await navigator.clipboard.writeText(texto);
            this.mostrarNotificacao('Texto copiado!');
        } catch (err) {
            console.error('Erro ao copiar texto:', err);
            // Fallback para navegadores mais antigos
            const textArea = document.createElement('textarea');
            textArea.value = texto;
            textArea.style.position = 'fixed';
            textArea.style.opacity = '0';
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            this.mostrarNotificacao('Texto copiado!');
        }
    }

    // Mostrar notificação
    mostrarNotificacao(mensagem) {
        const notificacao = document.createElement('div');
        notificacao.className = 'notificacao';
        notificacao.textContent = mensagem;
        notificacao.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #4a90e2;
            color: white;
            padding: 10px 20px;
            border-radius: 5px;
            z-index: 1000;
            opacity: 0;
            transition: opacity 0.3s ease;
        `;

        document.body.appendChild(notificacao);
        
        setTimeout(() => { notificacao.style.opacity = '1'; }, 10);
        
        setTimeout(() => {
            notificacao.style.opacity = '0';
            setTimeout(() => {
                if (document.body.contains(notificacao)) {
                    document.body.removeChild(notificacao);
                }
            }, 300);
        }, 3000);
    }

    // Baixar como Word
    baixarComoWord() {
        const titulo = elementos.resultTitle?.textContent || 'Esboço';
        const tipo = elementos.resultType?.textContent || '';
        const pre = elementos.referenciasList?.querySelector('pre');

        if (!pre) {
            this.mostrarErro('Nenhum conteúdo para exportar.');
            return;
        }

        const conteudo = `${titulo}\n${tipo}\n\n${pre.textContent}`;
        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <title>${titulo}</title>
            </head>
            <body>
                <h1>${titulo}</h1>
                <h2>${tipo}</h2>
                <pre style="white-space: pre-wrap; font-family: Arial, sans-serif;">${pre.textContent}</pre>
            </body>
            </html>
        `;

        const blob = new Blob([htmlContent], { type: 'application/msword' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `${titulo.replace(/\s+/g, '_')}.doc`;

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        URL.revokeObjectURL(link.href);
        this.mostrarNotificacao('Download iniciado!');
    }

    // Exportar resultado (copiar)
    exportarResultado() {
        const titulo = elementos.resultTitle?.textContent || '';
        const tipo = elementos.resultType?.textContent || '';
        const pre = elementos.referenciasList?.querySelector('pre');

        if (!pre) {
            this.mostrarErro('Nenhum conteúdo para exportar.');
            return;
        }

        const conteudo = `${titulo}\n${tipo}\n\n${pre.textContent}`.trim();
        this.copiarTexto(conteudo);
    }

    // Limpar formulário
    limparFormulario() {
        if (elementos.tipoDiscurso) elementos.tipoDiscurso.value = '';
        if (elementos.tempo) elementos.tempo.value = '';
        if (elementos.tema) elementos.tema.value = '';
        if (elementos.informacoesAdicionais) elementos.informacoesAdicionais.value = '';
        if (elementos.versiculosOpicionais) elementos.versiculosOpicionais.value = '';
        if (elementos.topicosOpicionais) elementos.topicosOpicionais.value = '';
        
        this.esconderElementos();
    }

    // Alternar favorito
    async toggleFavorito(docId, favoritoAtual) {
        try {
            await db.collection("esbocos").doc(docId).update({ favorito: !favoritoAtual });
            await this.carregarHistorico(this.usuarioAtual.uid);
            this.mostrarNotificacao(!favoritoAtual ? 'Adicionado aos favoritos!' : 'Removido dos favoritos!');
        } catch (error) {
            console.error('Erro ao alternar favorito:', error);
            this.mostrarErro('Erro ao atualizar favorito.');
        }
    }

    // Abrir modal de edição
    abrirModalEdicao(docId, data) {
        this.docIdEmEdicao = docId;
        document.getElementById('edicaoTema').value = data.tema || '';
        // Preencher o select com o valor original salvo no Firestore
        document.getElementById('edicaoTipo').value = data.tipoDiscurso || '';
        document.getElementById('edicaoConteudo').value = data.conteudo || '';
        document.getElementById('modalEdicao').style.display = 'flex';
        console.log('[EDICAO] Abrindo modal para docId:', docId, 'dados:', data);
    }

    // Fechar modal de edição
    fecharModalEdicao() {
        this.docIdEmEdicao = null;
        document.getElementById('modalEdicao').style.display = 'none';
    }

    // Salvar edição
    async salvarEdicaoEsboco(e) {
        if (e) {
            if (typeof e.preventDefault === 'function') e.preventDefault();
            if (typeof e.stopPropagation === 'function') e.stopPropagation();
        }
        const docId = this.docIdEmEdicao;
        if (!docId) return;
        const tema = document.getElementById('edicaoTema').value.trim();
        const tipo = document.getElementById('edicaoTipo').value;
        const conteudo = document.getElementById('edicaoConteudo').value.trim();
        console.log('[EDICAO] Salvando docId:', docId, 'tema:', tema, 'tipo:', tipo, 'conteudo:', conteudo);
        if (!tema || !tipo || !conteudo) {
            this.mostrarErro('Preencha todos os campos para salvar a edição.');
            return;
        }
        try {
            await db.collection('esbocos').doc(docId).update({
                tema,
                tipoDiscurso: tipo,
                conteudo
            });
            console.log('[EDICAO] Update Firestore OK para docId:', docId);
            this.fecharModalEdicao();
            await this.carregarHistorico(this.usuarioAtual.uid);
            this.mostrarNotificacao('Esboço editado com sucesso!');
        } catch (error) {
            console.error('[EDICAO] Erro ao editar esboço:', error);
            let mensagem = 'Erro ao salvar edição do esboço.';
            if (error && error.code) {
                mensagem += ` [${error.code}]`;
            }
            if (error && error.message) {
                mensagem += `\n${error.message}`;
            }
            this.mostrarErro(mensagem);
        }
    }

    // Abrir modal de visualização detalhada
    abrirModalDetalheEsboco(data, docId) {
        document.getElementById('detalheTema').textContent = data.tema || 'Esboço';
        document.getElementById('detalheTipo').textContent = this.formatarTipoDiscurso(data.tipoDiscurso);
        document.getElementById('detalheData').textContent = data.criadoEm && data.criadoEm.toDate ? 'Criado em: ' + data.criadoEm.toDate().toLocaleString('pt-BR') : '';
        document.getElementById('detalheConteudo').innerHTML = this.formatarNegrito(data.conteudo || '');
        document.getElementById('msgModalDetalhe').textContent = '';
        document.getElementById('modalDetalheEsboco').classList.add('show');
        this.configurarBotoesModalDetalhe(data, docId);
    }

    // Configurar botões do modal detalhado
    configurarBotoesModalDetalhe(data, docId) {
        const msg = document.getElementById('msgModalDetalhe');
        // Copiar
        document.getElementById('btnDetalheCopiar').onclick = () => {
            navigator.clipboard.writeText(data.conteudo || '').then(() => {
                msg.textContent = 'Conteúdo copiado!';
            });
        };
        // Exportar
        document.getElementById('btnDetalheExportar').onclick = () => {
            const titulo = data.tema || 'Esboço';
            const tipo = this.formatarTipoDiscurso(data.tipoDiscurso);
            const conteudo = data.conteudo || '';
            const htmlContent = `<!DOCTYPE html><html><head><meta charset='utf-8'><title>${titulo}</title></head><body><h1>${titulo}</h1><h2>${tipo}</h2><pre style='white-space: pre-wrap; font-family: Arial, sans-serif;'>${conteudo}</pre></body></html>`;
            const blob = new Blob([htmlContent], { type: 'application/msword' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `${titulo.replace(/\s+/g, '_')}.doc`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);
            msg.textContent = 'Download iniciado!';
        };
        // Editar
        document.getElementById('btnDetalheEditar').onclick = () => {
            this.fecharModalDetalheEsboco();
            this.abrirModalEdicao(docId, data);
        };
        // E-mail
        document.getElementById('btnDetalheEmail').onclick = () => {
            const assunto = encodeURIComponent('Esboço Gerado');
            const corpo = encodeURIComponent(data.conteudo || '');
            window.open(`mailto:?subject=${assunto}&body=${corpo}`);
        };
        // WhatsApp
        document.getElementById('btnDetalheWhats').onclick = () => {
            const msgW = encodeURIComponent(data.conteudo || '');
            window.open(`https://wa.me/?text=${msgW}`);
        };
        // Link público
        document.getElementById('btnDetalheLink').onclick = async () => {
            const url = window.location.origin + '/esboco.html?id=' + docId;
            await navigator.clipboard.writeText(url);
            msg.textContent = 'Link público copiado!';
        };
    }

    fecharModalDetalheEsboco() {
        document.getElementById('modalDetalheEsboco').classList.remove('show');
    }
}

// Inicializar aplicação quando o DOM estiver carregado
document.addEventListener('DOMContentLoaded', () => {
    window.geradorEsboco = new GeradorEsboco();

    // Eventos do modal de edição (garante que o DOM já carregou)
    const modal = document.getElementById('modalEdicao');
    const fecharModalBtn = document.getElementById('fecharModalEdicao');
    const cancelarEdicaoBtn = document.getElementById('cancelarEdicao');
    const formEdicao = document.getElementById('formEdicaoEsboco');
    if (modal && fecharModalBtn && cancelarEdicaoBtn && formEdicao) {
        fecharModalBtn.onclick = () => window.geradorEsboco.fecharModalEdicao();
        cancelarEdicaoBtn.onclick = () => window.geradorEsboco.fecharModalEdicao();
        formEdicao.onsubmit = (e) => {
            if (e) {
                if (typeof e.preventDefault === 'function') e.preventDefault();
                if (typeof e.stopPropagation === 'function') e.stopPropagation();
            }
            window.geradorEsboco.salvarEdicaoEsboco(e);
            return false;
        };
    }

    // Eventos do modal detalhado
    const modalDetalhe = document.getElementById('modalDetalheEsboco');
    const fecharModalDetalheBtn = document.getElementById('fecharModalDetalhe');
    if (modalDetalhe && fecharModalDetalheBtn) {
        fecharModalDetalheBtn.onclick = () => window.geradorEsboco.fecharModalDetalheEsboco();
    }
});

// Funções globais para serem chamadas pelo HTML
function gerarEsboco() {
    window.geradorEsboco?.gerarEsboco();
}

function abrirMenu() {
    window.geradorEsboco?.abrirMenu();
}

function fecharMenu() {
    window.geradorEsboco?.fecharMenu();
}

function logout() {
    window.geradorEsboco?.logout();
}

function baixarComoWord() {
    window.geradorEsboco?.baixarComoWord();
}

function exportarResultado() {
    window.geradorEsboco?.exportarResultado();
}

function limparFormulario() {
    window.geradorEsboco?.limparFormulario();
}