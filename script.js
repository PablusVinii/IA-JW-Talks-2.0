// Configurações da API
const API_URL = 'http://localhost:5678/webhook/gerar-esboco'; // URL do webhook n8n

// Elementos DOM
const elementos = {
    tipoDiscurso: document.getElementById('tipoDiscurso'),
    tema: document.getElementById('tema'),
    loading: document.getElementById('loading'),
    resultSection: document.getElementById('resultSection'),
    errorMessage: document.getElementById('errorMessage'),
    resultTitle: document.getElementById('resultTitle'),
    resultType: document.getElementById('resultType'),
    pontosList: document.getElementById('pontosList'),
    referenciasList: document.getElementById('referenciasList')
};

// Função principal para gerar esboço
async function gerarEsboco() {
    const tipoDiscurso = elementos.tipoDiscurso.value;
    const tema = elementos.tema.value.trim();

    // Validação
    if (!tipoDiscurso) {
        mostrarAlerta('Por favor, selecione o tipo de discurso!');
        return;
    }

    // Preparar interface
    mostrarCarregamento(true);
    esconderElementos();

    try {
        // Fazer requisição para API
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                tipo_discurso: tipoDiscurso,
                tema: tema || null
            })
        });

        // Verificar se a resposta foi bem-sucedida
        if (!response.ok) {
            throw new Error(`Erro HTTP: ${response.status} - ${response.statusText}`);
        }

        const data = await response.json();
        
        // Validar dados recebidos
        if (!data || typeof data !== 'object') {
            throw new Error('Resposta inválida do servidor');
        }

        mostrarResultado(data);

    } catch (error) {
        console.error('Erro ao gerar esboço:', error);
        mostrarErro(`Erro ao gerar esboço: ${error.message}`);
    } finally {
        mostrarCarregamento(false);
    }
}

// Função para mostrar o carregamento
function mostrarCarregamento(mostrar) {
    elementos.loading.style.display = mostrar ? 'block' : 'none';
    
    // Desabilitar/habilitar botão
    const botao = document.querySelector('.btn');
    botao.disabled = mostrar;
    botao.textContent = mostrar ? '⏳ Gerando...' : '🔍 Gerar Esboço';
}

// Função para esconder elementos
function esconderElementos() {
    elementos.resultSection.style.display = 'none';
    elementos.errorMessage.style.display = 'none';
}

// Função para mostrar resultado
function mostrarResultado(esboco) {
    try {
        // Definir título e tipo
        elementos.resultTitle.textContent = esboco.titulo || 'Esboço Gerado';
        elementos.resultType.textContent = obterTextoTipo(esboco.tipo);

        // Processar pontos principais
        processarPontos(esboco.pontos);

        // Processar referências bíblicas
        processarReferencias(esboco.referencias);

        // Mostrar seção de resultados
        elementos.resultSection.style.display = 'block';

        // Scroll suave para o resultado
        elementos.resultSection.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'start' 
        });

    } catch (error) {
        console.error('Erro ao processar resultado:', error);
        mostrarErro('Erro ao processar os dados recebidos');
    }
}

// Função para obter texto do tipo de discurso
function obterTextoTipo(tipo) {
    const tipos = {
        'tesouros': 'Tesouros da Palavra de Deus',
        'publico': 'Discurso Público'
    };
    return tipos[tipo] || 'Tipo não especificado';
}

// Função para processar pontos principais
function processarPontos(pontos) {
    elementos.pontosList.innerHTML = '';
    
    if (pontos && Array.isArray(pontos) && pontos.length > 0) {
        pontos.forEach((ponto, index) => {
            if (ponto && typeof ponto === 'string' && ponto.trim()) {
                const li = criarElementoPonto(ponto.trim(), index + 1);
                elementos.pontosList.appendChild(li);
            }
        });
    } else {
        const li = criarElementoPonto(
            'Nenhum ponto específico encontrado. Consulte a biblioteca JW.org para mais detalhes.'
        );
        elementos.pontosList.appendChild(li);
    }
}

// Função para criar elemento de ponto
function criarElementoPonto(texto, numero = null) {
    const li = document.createElement('li');
    li.textContent = texto;
    
    if (numero) {
        li.setAttribute('data-numero', numero);
    }
    
    return li;
}

// Função para processar referências bíblicas
function processarReferencias(referencias) {
    elementos.referenciasList.innerHTML = '';
    
    if (referencias && Array.isArray(referencias) && referencias.length > 0) {
        const referenciasUnicas = [...new Set(referencias)]; // Remove duplicatas
        
        referenciasUnicas.forEach(ref => {
            if (ref && typeof ref === 'string' && ref.trim()) {
                const div = criarElementoReferencia(ref.trim());
                elementos.referenciasList.appendChild(div);
            }
        });
    } else {
        const div = criarElementoReferencia(
            'Consulte a Bíblia para referências apropriadas'
        );
        elementos.referenciasList.appendChild(div);
    }
}

// Função para criar elemento de referência
function criarElementoReferencia(texto) {
    const div = document.createElement('div');
    div.className = 'referencia-item';
    div.textContent = texto;
    
    // Adicionar evento de clique para copiar
    div.addEventListener('click', () => {
        copiarTexto(texto);
        div.style.transform = 'scale(0.95)';
        setTimeout(() => {
            div.style.transform = 'scale(1)';
        }, 150);
    });
    
    div.title = 'Clique para copiar';
    
    return div;
}

// Função para mostrar erro
function mostrarErro(mensagem) {
    elementos.errorMessage.textContent = mensagem;
    elementos.errorMessage.style.display = 'block';
    
    // Scroll para o erro
    elementos.errorMessage.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'center' 
    });
}

// Função para mostrar alerta
function mostrarAlerta(mensagem) {
    alert(mensagem);
}

// Função para copiar texto
async function copiarTexto(texto) {
    try {
        await navigator.clipboard.writeText(texto);
        mostrarNotificacao('Texto copiado!');
    } catch (err) {
        console.error('Erro ao copiar texto:', err);
        // Fallback para navegadores mais antigos
        const textArea = document.createElement('textarea');
        textArea.value = texto;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        mostrarNotificacao('Texto copiado!');
    }
}

// Função para mostrar notificação
function mostrarNotificacao(mensagem) {
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
    
    // Animar entrada
    setTimeout(() => {
        notificacao.style.opacity = '1';
    }, 10);
    
    // Remover após 3 segundos
    setTimeout(() => {
        notificacao.style.opacity = '0';
        setTimeout(() => {
            document.body.removeChild(notificacao);
        }, 300);
    }, 3000);
}

// Event Listeners
document.addEventListener('DOMContentLoaded', function() {
    // Permitir envio com Enter no campo tema
    elementos.tema.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            gerarEsboco();
        }
    });
    
    // Limpar resultado ao mudar tipo de discurso
    elementos.tipoDiscurso.addEventListener('change', function() {
        esconderElementos();
    });
    
    // Limpar mensagem de erro ao digitar
    elementos.tema.addEventListener('input', function() {
        if (elementos.errorMessage.style.display === 'block') {
            elementos.errorMessage.style.display = 'none';
        }
    });
});

// Função para exportar resultado (funcionalidade extra)
function exportarResultado() {
    const titulo = elementos.resultTitle.textContent;
    const tipo = elementos.resultType.textContent;
    
    const pontos = Array.from(elementos.pontosList.children)
        .map(li => li.textContent)
        .join('\n');
    
    const referencias = Array.from(elementos.referenciasList.children)
        .map(div => div.textContent)
        .join(', ');
    
    const conteudo = `
${titulo}
${tipo}

PONTOS PRINCIPAIS:
${pontos}

REFERÊNCIAS BÍBLICAS:
${referencias}
    `.trim();
    
    copiarTexto(conteudo);
}

// Função para limpar formulário
function limparFormulario() {
    elementos.tipoDiscurso.value = '';
    elementos.tema.value = '';
    esconderElementos();
}