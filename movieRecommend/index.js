var express = require('express');
var path = require('path');
var logger = require('morgan');
var bodyParser = require('body-parser');
const { append } = require('express/lib/response');
var neo4j = require('neo4j-driver');
var index = express();

index.set('views', path.join(__dirname, 'views'));
index.set('view engine', 'ejs');
index.use(logger('dev'));
index.use(bodyParser.json());
index.use(bodyParser.urlencoded({ extended: false }));

var driver = neo4j.driver('bolt://localhost', neo4j.auth.basic('neo4j', 'UbuntuE'));
var session = driver.session();

index.get('/', function(req, res) {
    session
        .run('MATCH(n:Movie) RETURN n')
        .then(function(result) {
            var movieArr = [];
            result.records.forEach(function(record) {
                movieArr.push({
                    title: record._fields[0].properties.title,
                    released: record._fields[0].properties.released,
                    genre: record._fields[0].properties.genre
                });
            });
            session
                .run('MATCH(d:Director) RETURN d')
                .then(function(result2) {
                    var directorArr = [];
                    result2.records.forEach(function(record) {
                        directorArr.push({
                            name: record._fields[0].properties.name,
                            surname: record._fields[0].properties.surname,
                            born: record._fields[0].properties.born
                        });
                    });

                    session
                        .run('MATCH (m:Movie) WHERE NOT ()-[:DIRECTED]->(m) RETURN m')
                        .then(function(result3) {
                            var undirectedMoviesArr = [];
                            result3.records.forEach(function(record) {
                                undirectedMoviesArr.push({
                                    title: record._fields[0].properties.title,

                                });
                            });

                            res.render('index', {
                                movies: movieArr,
                                directors: directorArr,
                                undirected: undirectedMoviesArr,
                                recommendation: []
                            });
                        })
                        .catch(function(error) { console.log(error) });
                })
                .catch(function(error) { console.log(error) });
        })
        .catch(function(error) { console.log(error) });
});

index.post('/movie/add', function(req, res) {
    var title = req.body.movieTitle;
    var release = req.body.movieRelease;
    var genre = req.body.movieGenre;

    session
        .run('CREATE(m:Movie {title:{titleParam},release:{releaseParam},genre:{genreParam}}) RETURN m.title', { titleParam: title, releaseParam: release, genreParam: genre })
        .then(function(result) {
            res.redirect('/');
        })
        .catch(function(error) { console.log(error) });
});

index.post('/director/add', function(req, res) {
    var name = req.body.directorName;
    var surname = req.body.directorSurname;
    var born = req.body.directorBorn;

    session
        .run('CREATE(d:Director {name:{nameParam},surname:{surnameParam},born:{bornParam}}) RETURN d.name', { nameParam: name, surnameParam: surname, bornParam: born })
        .then(function(result) {
            res.redirect('/');
        })
        .catch(function(error) { console.log(error) });
});

index.post('/directing/add', function(req, res) {
    var name = req.body.directorName;
    var title = req.body.movieTitle;

    session
        .run('MATCH (d:Director{name:{nameParam}}),(m:Movie{title:{titleParam}}) MERGE (d)-[:DIRECTED]->(m) RETURN d,m', { nameParam: name, titleParam: title, })
        .then(function(result) {
            res.redirect('/');
        })
        .catch(function(error) { console.log(error) });
});

index.post('/review/add', function(req, res) {
    var name = req.body.userName;
    var surname = req.body.userSurname;
    var movie = req.body.movieTitle;
    var rating = req.body.rating;
    var comment = req.body.comment;

    session
        .run('MATCH (u:User {name:{nameParam}, surname:{surnameParam}}), (m:Movie {title:{movieParam}}) CREATE (u)-[:REVIEW {rating:{ratingParam}, comment:{commentParam}}]->(m);', { nameParam: name, surnameParam: surname, movieParam: movie, ratingParam: rating, commentParam: comment })
        .then(function(result) {
            res.redirect('/');
        })
        .catch(function(error) { console.log(error) });
});

index.post('/recommend/add', function(req, res) {
    var nameRecommend;
    var surnameRecommend;
    var genreRecommended;

    if (typeof req.body.userName !== 'undefined') {
        nameRecommend = req.body.userName;
        surnameRecommend = req.body.userSurname;
    } else {
        genreRecommended = req.body.genre;
    }

    var movieArr = [];
    var directorArr = [];
    var undirectedMoviesArr = [];
    var recommendArr = [];

    session
        .run('MATCH(n:Movie) RETURN n')
        .then(function(result) {
            result.records.forEach(function(record) {
                movieArr.push({
                    title: record._fields[0].properties.title,
                    released: record._fields[0].properties.released,
                    genre: record._fields[0].properties.genre
                });
            });

            session
                .run('MATCH(d:Director) RETURN d')
                .then(function(result2) {
                    result2.records.forEach(function(record) {
                        directorArr.push({
                            name: record._fields[0].properties.name,
                            surname: record._fields[0].properties.surname,
                            born: record._fields[0].properties.born
                        });
                    });

                    session
                        .run('MATCH (m:Movie) WHERE NOT ()-[:DIRECTED]->(m) RETURN m')
                        .then(function(result3) {
                            result3.records.forEach(function(record) {
                                undirectedMoviesArr.push({
                                    title: record._fields[0].properties.title,
                                });
                            });

                            if (typeof req.body.userName !== 'undefined') {
                                session
                                    .run('MATCH (u:User)-[r:REVIEW]->(m:Movie) WHERE r.rating >=5 AND NOT EXISTS ((u:User{name:{userNameParam}, surname:{userSurnameParam}})-[:REVIEW]->(m)) RETURN DISTINCT m.title', { userNameParam: nameRecommend, userSurnameParam: surnameRecommend })
                                    .then(function(result4) {
                                        result4.records.forEach(function(record) {

                                            recommendArr.push({
                                                movieTitle: record._fields[0],
                                            });
                                        });
                                        res.render('index', {
                                            movies: movieArr,
                                            directors: directorArr,
                                            undirected: undirectedMoviesArr,
                                            recommendation: recommendArr
                                        });
                                    })
                                    .catch(function(error) { console.log(error) });
                            } else {
                                session
                                    .run('MATCH (u:User)-[r:REVIEW]->(m:Movie) WHERE r.rating >=5 AND m.genre={genreParam} RETURN m', { genreParam: genreRecommended })
                                    .then(function(result4) {
                                        result4.records.forEach(function(record) {

                                            recommendArr.push({
                                                movieTitle: record._fields[0].properties.title,
                                            });
                                        });
                                        res.render('index', {
                                            movies: movieArr,
                                            directors: directorArr,
                                            undirected: undirectedMoviesArr,
                                            recommendationGenre: recommendArr
                                        });
                                    })
                                    .catch(function(error) { console.log(error) });
                            }
                        })
                        .catch(function(error) { console.log(error) });
                })
                .catch(function(error) { console.log(error) });
        })
        .catch(function(error) { console.log(error) });
});

index.listen(3000);
console.log('Server started');

module.exports = index;