const express = require('express');
const path = require('path');
const fs = require('fs');
const bodyParser = require('body-parser');
const app = express();
const mysql = require('mysql');
const multer = require('multer');
const session = require('express-session')
const sharp = require('sharp');

// CONFIGS

app.set('view engine', 'ejs'); // setar o ejs como view engine
app.set('views', path.join(__dirname, './public/views')); // configurar o diretório das views
app.use(express.static(path.join(__dirname, 'public'))); // configurar o diretório 'public' como padrão
app.use(bodyParser.urlencoded({ extended: true })); // configurar o body-parser para processar dados de formulários


const storage = multer.diskStorage({
  destination: (req, file, cb) => {
      cb(null, './public/resources/pictures/temp');
  },
  filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ dest: 'uploads/' });


app.use(session({secret: 'teste', saveUninitialized:true, resave: true}))
app.use((req, res, next) => {
    if (req.session.logado === undefined) {
        req.session.logado = false; // Definir como false por padrão
    }
    app.locals.userId = req.session.userId;
    app.locals.admin = req.session.admin;
    app.locals.logado = req.session.logado;
    next();
});

// ACESSO SERVER E DB 

const PORT = process.env.PORT || 3000; // definir a porta do server

const connection = mysql.createConnection({
  host: 'localhost', 
  user: 'root', 
  password: '123456789', 
  database: 'fungoDB'
});

// MODELS
const Usuario = require('./models/Usuario');
const RegistroFungo = require('./models/RegistroFungo');
const Coleta = require('./models/Coleta');
const Autor = require('./models/Autor');
//const UnidadeTaxonomica = require('./models/UnidadeTaxonomica');
const Taxon = require('./models/Taxon');
const Foto = require('./models/Foto');
//const Caixa = require('./models/Caixa');

// FUNÇÕES SERVER

app.post('/login', function(req, res){
    const {email, senha} = req.body;
    const user = new Usuario();


    user.email = email;
    user.senha = senha;

    user.logar(connection, (result) => {
        if (result.length > 0) {
            req.session.logado = true;
            req.session.userId = result[0].id;
            if (result[0].cargo == 'admin') {
                req.session.admin = true;
            }
            res.redirect('/');
        }
        else {
            res.redirect('/')
        }
    })   
	
});

app.get('/logout', function(req, res){ 
	req.session.logado = false;
    req.session.admin = false;
    req.session.userId = '';
	res.redirect('/');
});


app.post('/usuario/create', (req, res) => {
  const { nome, sobrenome, ultimonome, email, senha } = req.body;

  const newUsuario = new Usuario(null, nome, sobrenome, ultimonome, email, senha);

  newUsuario.save(connection, (err, result) => {
      if (err) {
          return res.status(500).send('Erro ao criar usuário: ' + err.message);
      }
      res.redirect('/usuario/new');
  });
});


app.post('/registroFungo/create', upload.array('fotos', 10), (req, res) => {
    const { data, coordenada, Taxons_id, ordem, genero, epiteto, caixas_id, novaCaixa, observacoes } = req.body;
    const userId = req.session.userId; // Obtém o userId da sessão

    if (!userId) {
        return res.status(401).send('Usuário não autenticado');
    }

    // Consulta para obter o autor_id baseado no userId
    const sqlGetAutorId = 'SELECT autor_id FROM Usuarios WHERE id = ?';
    connection.query(sqlGetAutorId, [userId], (err, results) => {
        if (err) {
            console.error('Erro ao obter autor_id:', err);
            return res.status(500).send('Erro ao obter autor_id');
        }

        if (results.length === 0) {
            return res.status(404).send('Autor não encontrado');
        }

        const autor_id = results[0].autor_id;

        // Verifica se o usuário preencheu os campos de nova espécie
        if (ordem && genero && epiteto) {
            const novoTaxon = `${genero} ${epiteto}`;

            // Primeiro, adiciona o novo táxon à tabela de taxons
            const sqlAddTaxon = 'INSERT INTO Taxons (nome, autor_id, unidadesTaxonomicas_id, taxonanterior_id) VALUES (?, ?, ?, ?)';
            connection.query(sqlAddTaxon, [novoTaxon, autor_id, 11, ordem], (err, result) => {
                if (err) {
                    console.error('Erro ao adicionar novo táxon:', err);
                    return res.status(500).send('Erro ao adicionar novo táxon');
                }

                const novoTaxonId = result.insertId;

                // Agora, adiciona o novo registro de fungo com o novo táxon
                processarCaixaEResgistro(res, connection, data, coordenada, autor_id, novoTaxonId, caixas_id, novaCaixa, req.files, observacoes);
            });
        } else {
            // Se não foi inserida uma nova espécie, salva o registro normalmente
            processarCaixaEResgistro(res, connection, data, coordenada, autor_id, Taxons_id, caixas_id, novaCaixa, req.files, observacoes);
        }
    });
});

function processarCaixaEResgistro(res, connection, data, coordenada, autor_id, Taxons_id, caixas_id, novaCaixa, files, observacoes) {
    if (caixas_id === 'nova' && novaCaixa) {
        // Se o usuário escolheu adicionar uma nova caixa, insere a caixa na tabela 'Caixas'
        const sqlAddCaixa = 'INSERT INTO Caixas (nome) VALUES (?)';
        connection.query(sqlAddCaixa, [novaCaixa], (err, result) => {
            if (err) {
                console.error('Erro ao adicionar nova caixa:', err);
                return res.status(500).send('Erro ao adicionar nova caixa');
            }

            const novaCaixaId = result.insertId;
            // Salva o registro de fungo com a nova caixa
            salvarRegistroEColeta(res, connection, data, coordenada, autor_id, Taxons_id, novaCaixaId, files, observacoes);
        });
    } else {
        // Caso contrário, usa a caixa selecionada ou um valor padrão se não houver caixa
        const caixaId = caixas_id === '' || caixas_id === undefined ? null : caixas_id;
        salvarRegistroEColeta(res, connection, data, coordenada, autor_id, Taxons_id, caixaId, files, observacoes);
    }
}

function salvarRegistroEColeta(res, connection, data, coordenada, autor_id, Taxons_id, caixas_id, files, observacoes) {
    const newRegistro = new RegistroFungo(null, data, coordenada, autor_id, Taxons_id, observacoes);

    newRegistro.save(connection, (err, result) => {
        if (err) {
            console.error('Erro ao adicionar registro de fungo:', err);
            return res.status(500).send('Erro ao adicionar registro de fungo');
        }

        const idRegistro = result.insertId;

        // Salva os dados na tabela 'Coletas' somente se `caixas_id` não for nulo
        if (caixas_id !== null) {
            const sqlAddColeta = 'INSERT INTO Coletas (autor_id, RegistroFungos_id, Taxons_id, Caixas_id) VALUES (?, ?, ?, ?)';
            connection.query(sqlAddColeta, [autor_id, idRegistro, Taxons_id, caixas_id], (err) => {
                if (err) {
                    console.error('Erro ao adicionar coleta:', err);
                    return res.status(500).send('Erro ao adicionar coleta');
                }

                salvarFotos(res, connection, autor_id, idRegistro, files);
            });
        } else {
            salvarFotos(res, connection, autor_id, idRegistro, files);
        }
    });
}   


function salvarFotos(res, connection, autor_id, idRegistro, files) {
    files.forEach((file, index) => {
        const ext = path.extname(file.originalname);
        const newFilename = `${idRegistro} (${index + 1}).jpg`; // Nome do arquivo em formato JPG
        const oldPath = file.path;
        const newPath = path.join('public/resources/pictures', newFilename);

        // Converter a imagem para JPG e salvar no diretório final
        sharp(oldPath)
            .toFormat('jpg')
            .toFile(newPath, (err) => {
                if (err) {
                    console.error('Erro ao converter imagem:', err);
                } else {

                    // Adiciona a entrada na tabela 'Fotos'
                    const sql = 'INSERT INTO Fotos (autor_id, RegistroFungos_id) VALUES (?, ?)';
                    connection.query(sql, [autor_id, idRegistro], (err) => {
                        if (err) {
                            console.error('Erro ao adicionar foto:', err);
                        }
                    });
                }
            });
    });

    res.redirect('/registroFungo/new');
}



app.post('/search', (req, res) => {
  const searchValue = req.body.searchValue;

  const query = isNaN(searchValue)
      ? `SELECT r.id AS id, r.data, r.coordenada, t.nome AS especie, a.nome AS autor, COUNT(f.id) AS imageCount
         FROM RegistroFungos r
         LEFT JOIN Taxons t ON r.Taxons_id = t.id
         LEFT JOIN Autores a ON r.autor_id = a.id
         LEFT JOIN Fotos f ON r.id = f.RegistroFungos_id
         WHERE t.nome LIKE ? OR a.nome LIKE ?
         GROUP BY r.id, r.data, r.coordenada, t.nome, a.nome`
      : `SELECT r.id AS id, r.data, r.coordenada, t.nome AS especie, a.nome AS autor, COUNT(f.id) AS imageCount
         FROM RegistroFungos r
         LEFT JOIN Taxons t ON r.Taxons_id = t.id
         LEFT JOIN Autores a ON r.autor_id = a.id
         LEFT JOIN Fotos f ON r.id = f.RegistroFungos_id
         WHERE r.id = ?
         GROUP BY r.id, r.data, r.coordenada, t.nome, a.nome`;

  const searchQuery = isNaN(searchValue)
      ? [`%${searchValue}%`, `%${searchValue}%`]
      : [searchValue];

  connection.query(query, searchQuery, (err, results) => {
      if (err) {
          console.error(err);
          return res.status(500).send('Erro ao buscar registros');
      }
      res.render('searchResults', { registros: results });
  });
});







// ROTAS DO SERVER

app.get('/', (req, res) => { // Rota para a página principal

    res.render('index');
});


app.get('/fungox', (req, res) => {
    const idRegistro = req.query.value;

    if (!idRegistro || isNaN(idRegistro)) {
        return res.status(400).send('ID inválido');
    }

    const queryFotos = 'SELECT * FROM Fotos WHERE RegistroFungos_id = ? ORDER BY id ASC';
    const queryRegistro = 'SELECT * FROM RegistroFungos WHERE id = ?';
    const queryColetas = 'SELECT * FROM Coletas WHERE RegistroFungos_id = ?';
    const queryTaxon = 'SELECT t.nome FROM Taxons t INNER JOIN RegistroFungos r ON t.id = r.Taxons_id WHERE r.id = ?';

    connection.query(queryFotos, [idRegistro], (err, resultsFotos) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Erro ao buscar fotos');
        }

        if (resultsFotos.length === 0) {
            return res.status(404).send('Nenhuma foto encontrada para o registro');
        }

        const fotos = resultsFotos.map((foto, index) => {
            const nomeArquivo = foto.nomeArquivo || '';
            const extensao = nomeArquivo.match(/\.(jpg|jpeg|png|gif|bmp)$/i);
            const extensaoArquivo = extensao ? extensao[0] : '.jpg';
            return {
                ...foto,
                caminho: `${foto.RegistroFungos_id} (${index + 1})${extensaoArquivo}`,
                autor: foto.autor_id // Adiciona o ID do autor para uso no template
            };
        });

        connection.query(queryRegistro, [idRegistro], (err, resultadosRegistro) => {
            if (err) {
                console.error(err);
                return res.status(500).send('Erro ao buscar registro');
            }

            if (resultadosRegistro.length === 0) {
                return res.status(404).send('Registro não encontrado');
            }

            const registro = resultadosRegistro[0];

            connection.query(queryColetas, [idRegistro], (err, resultadosColetas) => {
                if (err) {
                    console.error(err);
                    return res.status(500).send('Erro ao buscar coletas');
                }

                const coleta = resultadosColetas.length > 0 ? resultadosColetas[0] : {};

                connection.query(queryTaxon, [idRegistro], (err, resultadosTaxon) => {
                    if (err) {
                        console.error(err);
                        return res.status(500).send('Erro ao buscar taxon');
                    }

                    const taxon = resultadosTaxon.length > 0 ? resultadosTaxon[0] : { nome: 'Desconhecido' };

                    res.render('fungox', {
                        idRegistro: idRegistro,
                        fotos: fotos,
                        registro: registro,
                        coleta: coleta,
                        caixa: coleta.Caixas_id ? { nome: `Caixa ${coleta.Caixas_id}` } : { nome: 'Não especificado' },
                        taxon: taxon
                    });
                });
            });
        });
    });
});

  



app.get('/usuario/new', (req, res) => { // Rota form usuários
  Usuario.findAll(connection, (err, usuarios) => {
      if (err) {
          return res.status(500).send('Erro ao buscar usuários: ' + err.message);
      }
      res.render('newUsuario', { usuarios });
  });
});


app.get('/registroFungo/new', (req, res) => {
    // Funções que retornam Promises
    const getRegistros = () => {
        return new Promise((resolve, reject) => {
            RegistroFungo.findAll(connection, (err, registros) => {
                if (err) return reject(err);
                resolve(registros);
            });
        });
    };

    const getUsuarios = () => {
        return new Promise((resolve, reject) => {
            Usuario.findAll(connection, (err, usuarios) => {
                if (err) return reject(err);
                resolve(usuarios);
            });
        });
    };

    const getTaxons = () => {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT * FROM Taxons
                ORDER BY
                  CASE
                    WHEN nome = 'Fungi incertae sedis' THEN 1
                    WHEN nome = 'Líquen incertae sedis' THEN 2
                    WHEN nome = 'Basidiomycota' THEN 3
                    WHEN nome = 'Russulales' THEN 4
                    WHEN nome = 'Polyporales' THEN 5
                    WHEN nome = 'Agaricales' THEN 6
                    ELSE 7
                  END;
            `;
            connection.query(sql, (err, taxons) => {
                if (err) return reject(err);
                resolve(taxons);
            });
        });
    };

    const getAutores = () => {
        return new Promise((resolve, reject) => {
            Autor.findAll(connection, (err, autores) => {
                if (err) return reject(err);
                resolve(autores);
            });
        });
    };

    const getFotos = () => {
        return new Promise((resolve, reject) => {
            Foto.findAll(connection, (err, fotos) => {
                if (err) return reject(err);
                resolve(fotos);
            });
        });
    };

    const getCaixas = () => {
        return new Promise((resolve, reject) => {
            const sqlGetCaixas = 'SELECT * FROM Caixas';
            connection.query(sqlGetCaixas, (err, caixas) => {
                if (err) return reject(err);
                resolve(caixas);
            });
        });
    };

    // Executa todas as consultas paralelamente
    Promise.all([getRegistros(), getUsuarios(), getTaxons(), getAutores(), getFotos(), getCaixas()])
        .then(([registros, usuarios, taxons, autores, fotos, caixas]) => {
            // Filtra as ordens (supondo que o ID de unidade taxonômica 9 seja para "ordem")
            const ordens = taxons.filter(taxon => taxon.unidadesTaxonomicas_id === 9);

            // Mapeia e limita registros para incluir as fotos correspondentes e formata a data
            registros = registros
                .sort((a, b) => b.id - a.id) // Ordena em ordem decrescente pelo 'id'
                .slice(0, 6) // Limita a 6 registros
                .map(registro => ({
                    ...registro,
                    formattedData: registro.formatData(),
                    fotos: fotos.filter(foto => foto.RegistroFungos_id === registro.id)
                }));

            // Renderiza a página com registros, usuários, taxons, autores, ordens e caixas
            res.render('newRegistro', { registros, usuarios, taxons, autores, ordens, caixas });
        })
        .catch(err => {
            res.status(500).send('Erro ao buscar dados: ' + err.message);
        });
});


  

// Feedback ao Iniciar o servidor
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});

connection.connect((err) => {
    if (err) {
        console.error('Erro ao conectar ao banco de dados: ' + err.stack);
        return;
    }
    console.log('Conectado ao banco de dados como ID ' + connection.threadId);
});
