/* ============================================================
   Jogo da Soma — lógica
   Princípios para o público TEA aplicados aqui:
   - Sem limite de tempo: a criança responde no seu ritmo
   - Erro nunca é punido: a ficha volta com calma e ela tenta de novo
   - Feedback sempre positivo e previsível (frases fixas e curtas)
   - Sons suaves e opcionais (podem ser desligados)
   - Um único tipo de desenho por pergunta, para não confundir
   - Arrastar e soltar com alvo grande e margem generosa de acerto;
     também funciona pelo teclado (Enter/Espaço na ficha focada)
   ============================================================ */

(function () {
    "use strict";

    // ---------- Configuração ----------

    var TOTAL_PERGUNTAS = 8;

    var NIVEIS = {
        1: { max: 5 },   // somas com resultado até 5
        2: { max: 10 },  // somas com resultado até 10
        3: { max: 20 }   // somas com resultado até 20
    };

    // Um desenho por pergunta (sorteado), sempre o mesmo nos dois grupos
    var DESENHOS = ["🍎", "⭐", "🐟", "🌸", "🍓", "🐤", "🧩", "🎈"];

    var FRASES_ACERTO = [
        "Muito bem!",
        "Isso mesmo!",
        "Você conseguiu!",
        "Ótimo trabalho!"
    ];

    var FRASE_APOIO = "Quase! Tente outra vez. Você consegue!";

    // Margem extra (em pixels) ao redor do alvo para facilitar o soltar
    var MARGEM_ALVO = 24;

    // ---------- Estado ----------

    var estado = {
        nivel: 1,
        perguntaAtual: 0,
        acertosPrimeira: 0,
        errouNesta: false,
        a: 0,
        b: 0,
        respondida: false,
        somLigado: true
    };

    // ---------- Elementos ----------

    var telas = {
        inicio: document.getElementById("tela-inicio"),
        jogo: document.getElementById("tela-jogo"),
        final: document.getElementById("tela-final")
    };

    var el = {
        botoesNivel: document.querySelectorAll(".botao-nivel"),
        botaoVoltar: document.getElementById("botao-voltar"),
        botaoSom: document.getElementById("botao-som"),
        progresso: document.getElementById("progresso"),
        grupoA: document.getElementById("grupo-a"),
        grupoB: document.getElementById("grupo-b"),
        numeroA: document.getElementById("numero-a"),
        numeroB: document.getElementById("numero-b"),
        interrogacao: document.getElementById("interrogacao"),
        opcoes: document.getElementById("opcoes"),
        feedback: document.getElementById("feedback"),
        botaoProxima: document.getElementById("botao-proxima"),
        resumoFinal: document.getElementById("resumo-final"),
        estrelasFinais: document.getElementById("estrelas-finais"),
        botaoJogarNovamente: document.getElementById("botao-jogar-novamente"),
        botaoInicioFinal: document.getElementById("botao-inicio-final")
    };

    // ---------- Som (tons suaves gerados no navegador) ----------

    var contextoAudio = null;

    function tocarTom(frequencia, duracao, atraso) {
        if (!estado.somLigado) return;
        try {
            if (!contextoAudio) {
                contextoAudio = new (window.AudioContext || window.webkitAudioContext)();
            }
            var inicio = contextoAudio.currentTime + (atraso || 0);
            var oscilador = contextoAudio.createOscillator();
            var ganho = contextoAudio.createGain();

            oscilador.type = "sine"; // timbre suave, sem sons ásperos
            oscilador.frequency.value = frequencia;

            // Volume baixo com entrada e saída graduais (sem estouro)
            ganho.gain.setValueAtTime(0, inicio);
            ganho.gain.linearRampToValueAtTime(0.12, inicio + 0.05);
            ganho.gain.linearRampToValueAtTime(0, inicio + duracao);

            oscilador.connect(ganho);
            ganho.connect(contextoAudio.destination);
            oscilador.start(inicio);
            oscilador.stop(inicio + duracao);
        } catch (e) {
            // Se o áudio não estiver disponível, o jogo segue sem som
        }
    }

    function somAcerto() {
        tocarTom(523.25, 0.25, 0);     // dó
        tocarTom(659.25, 0.3, 0.18);   // mi
    }

    function somApoio() {
        tocarTom(392, 0.3, 0); // um único tom calmo, nada de "erro" estridente
    }

    // ---------- Utilitários ----------

    function sortear(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    function embaralhar(lista) {
        for (var i = lista.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var tmp = lista[i];
            lista[i] = lista[j];
            lista[j] = tmp;
        }
        return lista;
    }

    function mostrarTela(nome) {
        for (var chave in telas) {
            telas[chave].classList.remove("ativa");
        }
        telas[nome].classList.add("ativa");
    }

    // ---------- Progresso ----------

    function desenharProgresso() {
        el.progresso.innerHTML = "";
        for (var i = 0; i < TOTAL_PERGUNTAS; i++) {
            var ponto = document.createElement("span");
            ponto.className = "ponto";
            if (i < estado.perguntaAtual) ponto.classList.add("feito");
            // Apenas a bolinha recém-conquistada pulsa uma vez
            if (i === estado.perguntaAtual - 1) ponto.classList.add("recem-feito");
            if (i === estado.perguntaAtual) ponto.classList.add("atual");
            el.progresso.appendChild(ponto);
        }
    }

    // ---------- Pergunta ----------

    function gerarPergunta() {
        var max = NIVEIS[estado.nivel].max;

        // Garante parcelas de pelo menos 1 e resultado dentro do limite
        estado.a = sortear(1, max - 1);
        estado.b = sortear(1, max - estado.a);
        estado.respondida = false;
        estado.errouNesta = false;

        var resultado = estado.a + estado.b;
        var desenho = DESENHOS[sortear(0, DESENHOS.length - 1)];

        // Números e visual
        el.numeroA.textContent = estado.a;
        el.numeroB.textContent = estado.b;
        el.interrogacao.textContent = "?";
        el.interrogacao.classList.remove("respondida", "pronta");

        desenharGrupo(el.grupoA, desenho, estado.a);
        desenharGrupo(el.grupoB, desenho, estado.b);

        // Opções: resposta certa + 2 alternativas próximas
        var opcoes = [resultado];
        while (opcoes.length < 3) {
            var alternativa = resultado + sortear(-3, 3);
            if (alternativa >= 0 && alternativa !== resultado && opcoes.indexOf(alternativa) === -1) {
                opcoes.push(alternativa);
            }
        }
        embaralhar(opcoes);

        el.opcoes.innerHTML = "";
        opcoes.forEach(function (valor, indice) {
            el.opcoes.appendChild(criarFicha(valor, indice, resultado));
        });

        el.feedback.textContent = "";
        el.feedback.className = "feedback";
        el.botaoProxima.classList.add("escondido");

        desenharProgresso();
    }

    function desenharGrupo(container, desenho, quantidade) {
        container.innerHTML = "";
        for (var i = 0; i < quantidade; i++) {
            var item = document.createElement("span");
            item.className = "item-visual";
            item.textContent = desenho;
            // Entrada levemente escalonada, apenas um fade suave
            item.style.animationDelay = (i * 0.06) + "s";
            container.appendChild(item);
        }
    }

    // ---------- Fichas arrastáveis ----------

    function criarFicha(valor, indice, resultado) {
        var ficha = document.createElement("button");
        ficha.className = "botao-opcao ficha-" + (indice + 1);
        ficha.textContent = valor;
        ficha.setAttribute(
            "aria-label",
            "Ficha com o número " + valor +
            ". Arraste até o quadradinho da resposta ou pressione Enter para colocar."
        );

        // Alternativa por teclado: Enter ou Espaço colocam a ficha no alvo
        ficha.addEventListener("keydown", function (evento) {
            if (evento.key === "Enter" || evento.key === " ") {
                evento.preventDefault();
                tentarResposta(ficha, valor, resultado);
            }
        });

        // Arrastar e soltar com Pointer Events (mouse, dedo ou caneta)
        ficha.addEventListener("pointerdown", function (evento) {
            iniciarArrasto(evento, ficha, valor, resultado);
        });

        return ficha;
    }

    function pointerSobreAlvo(evento) {
        var alvo = el.interrogacao.getBoundingClientRect();
        return evento.clientX >= alvo.left - MARGEM_ALVO &&
               evento.clientX <= alvo.right + MARGEM_ALVO &&
               evento.clientY >= alvo.top - MARGEM_ALVO &&
               evento.clientY <= alvo.bottom + MARGEM_ALVO;
    }

    function iniciarArrasto(evento, ficha, valor, resultado) {
        if (estado.respondida || ficha.disabled) return;
        evento.preventDefault();

        var rect = ficha.getBoundingClientRect();
        var deslocX = evento.clientX - rect.left;
        var deslocY = evento.clientY - rect.top;

        // Cópia visual que segue o dedo/mouse
        var fantasma = ficha.cloneNode(true);
        fantasma.classList.add("fantasma");
        fantasma.style.width = rect.width + "px";
        fantasma.style.height = rect.height + "px";
        fantasma.style.left = rect.left + "px";
        fantasma.style.top = rect.top + "px";
        document.body.appendChild(fantasma);

        ficha.classList.add("origem-arrasto");
        try {
            ficha.setPointerCapture(evento.pointerId);
        } catch (e) {
            // Alguns navegadores podem não suportar a captura; o arrasto
            // continua funcionando pelos eventos no próprio elemento
        }

        function aoMover(ev) {
            fantasma.style.left = (ev.clientX - deslocX) + "px";
            fantasma.style.top = (ev.clientY - deslocY) + "px";
            if (pointerSobreAlvo(ev)) {
                el.interrogacao.classList.add("pronta");
            } else {
                el.interrogacao.classList.remove("pronta");
            }
        }

        function encerrar() {
            ficha.classList.remove("origem-arrasto");
            ficha.removeEventListener("pointermove", aoMover);
            ficha.removeEventListener("pointerup", aoSoltar);
            ficha.removeEventListener("pointercancel", aoCancelar);
            el.interrogacao.classList.remove("pronta");
        }

        function devolverFantasma() {
            // A ficha volta com calma para o lugar de origem
            fantasma.classList.add("voltando");
            fantasma.style.left = rect.left + "px";
            fantasma.style.top = rect.top + "px";
            window.setTimeout(function () {
                fantasma.remove();
            }, 320);
        }

        function aoSoltar(ev) {
            var acertouAlvo = pointerSobreAlvo(ev);
            encerrar();
            if (acertouAlvo) {
                fantasma.remove();
                tentarResposta(ficha, valor, resultado);
            } else {
                // Soltar fora do alvo não é erro: a ficha apenas volta
                devolverFantasma();
            }
        }

        function aoCancelar() {
            encerrar();
            devolverFantasma();
        }

        ficha.addEventListener("pointermove", aoMover);
        ficha.addEventListener("pointerup", aoSoltar);
        ficha.addEventListener("pointercancel", aoCancelar);
    }

    // ---------- Resposta ----------

    function tentarResposta(ficha, valor, resultado) {
        if (estado.respondida) return;

        if (valor === resultado) {
            estado.respondida = true;
            if (!estado.errouNesta) {
                estado.acertosPrimeira++;
            }

            ficha.classList.add("correta");
            desabilitarFichas();

            el.interrogacao.textContent = resultado;
            el.interrogacao.classList.remove("pronta");
            el.interrogacao.classList.add("respondida");

            el.feedback.textContent = "⭐ " + FRASES_ACERTO[sortear(0, FRASES_ACERTO.length - 1)];
            el.feedback.className = "feedback acerto";

            somAcerto();

            // A criança avança quando quiser: o botão aparece, sem tempo automático
            el.botaoProxima.classList.remove("escondido");
            el.botaoProxima.focus();
        } else {
            // Erro tratado com acolhimento: a ficha apenas fica indisponível
            estado.errouNesta = true;
            ficha.classList.add("tentar-novamente");
            ficha.disabled = true;

            el.feedback.textContent = FRASE_APOIO;
            el.feedback.className = "feedback apoio";

            somApoio();
        }
    }

    function desabilitarFichas() {
        var fichas = el.opcoes.querySelectorAll("button");
        fichas.forEach(function (f) {
            f.disabled = true;
        });
    }

    // ---------- Fluxo ----------

    function comecarJogo(nivel) {
        estado.nivel = nivel;
        estado.perguntaAtual = 0;
        estado.acertosPrimeira = 0;
        mostrarTela("jogo");
        gerarPergunta();
    }

    function proximaPergunta() {
        estado.perguntaAtual++;
        if (estado.perguntaAtual >= TOTAL_PERGUNTAS) {
            mostrarFinal();
        } else {
            gerarPergunta();
        }
    }

    function mostrarFinal() {
        mostrarTela("final");

        el.estrelasFinais.innerHTML = "";
        for (var i = 0; i < TOTAL_PERGUNTAS; i++) {
            var estrela = document.createElement("span");
            estrela.className = "estrela-final";
            estrela.textContent = i < estado.acertosPrimeira ? "⭐" : "🌟";
            // Uma estrela por vez, em ritmo calmo
            estrela.style.animationDelay = (i * 0.25) + "s";
            el.estrelasFinais.appendChild(estrela);
        }

        el.resumoFinal.textContent =
            "Você completou as " + TOTAL_PERGUNTAS + " somas. Parabéns pelo seu esforço!";

        somAcerto();
    }

    // ---------- Eventos ----------

    el.botoesNivel.forEach(function (botao) {
        botao.addEventListener("click", function () {
            comecarJogo(parseInt(botao.getAttribute("data-nivel"), 10));
        });
    });

    el.botaoProxima.addEventListener("click", proximaPergunta);

    el.botaoVoltar.addEventListener("click", function () {
        mostrarTela("inicio");
    });

    el.botaoSom.addEventListener("click", function () {
        estado.somLigado = !estado.somLigado;
        el.botaoSom.setAttribute("aria-pressed", String(estado.somLigado));
        el.botaoSom.innerHTML = (estado.somLigado ? "🔊" : "🔇") +
            ' <span class="texto-botao-topo">Som</span>';
    });

    el.botaoJogarNovamente.addEventListener("click", function () {
        comecarJogo(estado.nivel);
    });

    el.botaoInicioFinal.addEventListener("click", function () {
        mostrarTela("inicio");
    });
})();
