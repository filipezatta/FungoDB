class Usuario {
    constructor(id, nome, sobrenome, ultimonome, email, senha, autor_id, autor_nome, permissoes) {
        this.id = id;
        this.nome = nome;
        this.sobrenome = sobrenome;
        this.ultimonome = ultimonome;
        this.email = email;
        this.senha = senha;
        this.permissoes = permissoes;
        this.autor_id = autor_id;
        this.autor_nome = autor_nome; // Adicionado
    }

    static formatAutorNome(nome, sobrenome, ultimonome) {
        return `${ultimonome.toUpperCase()}, ${nome[0].toUpperCase()}. ${sobrenome ? sobrenome[0].toUpperCase() + '.' : ''}`;
    }

    save(connection, callback) {
        const autorNome = Usuario.formatAutorNome(this.nome, this.sobrenome, this.ultimonome);
        const sqlAutor = 'INSERT INTO Autores (nome) VALUES (?)';
        
        connection.query(sqlAutor, [autorNome], (err, result) => {
            if (err) {
                return callback(err);
            }
            const autor_id = result.insertId;

            const sqlUsuario = 'INSERT INTO Usuarios (nome, sobrenome, ultimonome, email, senha, autor_id) VALUES (?, ?, ?, ?, ?, ?)';
            const values = [this.nome, this.sobrenome, this.ultimonome, this.email, this.senha, autor_id];
            
            connection.query(sqlUsuario, values, (err, result) => {
                if (err) {
                    return callback(err);
                }
                this.id = result.insertId;
                callback(null, result);
            });
        });
    }

    static findAll(connection, callback) {
        const sql = `
            SELECT u.id, u.nome, u.sobrenome, u.ultimonome, u.email, a.nome as autor_nome
            FROM Usuarios u
            JOIN Autores a ON u.autor_id = a.id
        `;
        connection.query(sql, (err, results) => {
            if (err) {
                return callback(err);
            }
            const usuarios = results.map(row => new Usuario(
                row.id,
                row.nome,
                row.sobrenome,
                row.ultimonome,
                row.email,
                null,
                row.autor_id,
                row.autor_nome
            ));
            callback(null, usuarios);
        });
    }

    logar(connection, callback) {
        connection.query('SELECT * FROM usuarios WHERE email = ? AND senha = ?', [this.email, this.senha], (err, result) => {
            if (err) throw err;
            return callback(result);
        });
    };
}

module.exports = Usuario;
