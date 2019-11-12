const { expect } = require('chai');
const knex = require('knex');
const app = require('../src/app');
const { makeFoldersArray } = require('./folders.fixtures');
const { makeNotesArray } = require('./notes.fixtures');

describe.only('Notes endpoints', function() {
  let db;
  before('make knex instance', () => {
    db = knex({
      client: 'pg',
      connection: process.env.TEST_DB_URL,
    });
    app.set('db', db);
  });
  after('disconnect from db', () => db.destroy());
  before('clean the table', () => db.raw('TRUNCATE notes, folders RESTART IDENTITY CASCADE'));
  afterEach('cleanup', () => db.raw('TRUNCATE notes, folders RESTART IDENTITY CASCADE'));

  describe('GET /api/notes', () => {
    context('Given no notes', () => {
      it('responds with 200 and am empty list', () => {
        return supertest(app)
          .get('/api/notes')
          .expect(200, []);
      });
    });
    context('given there are notes in the database', () => {
      const testFolders = makeFoldersArray();
      const testNotes = makeNotesArray();
      beforeEach('insert folders', () => {
        return db
          .into('folders')
          .insert(testFolders)
          .then(() => {
            return db
              .into('notes')
              .insert(testNotes);
          });
      });
      it('responds with 200 and all of the notes', () => {
        return supertest(app)
          .get('/api/notes')
          .expect(200, testNotes);
      });
    });
  });
  describe('POST /api/notes', () => {
    context('given there are notes and folders in the database', () => {
      const testFolders = makeFoldersArray();
      const testNotes = makeNotesArray();
      beforeEach('insert folders', () => {
        return db
          .into('folders')
          .insert(testFolders)
          .then(() => {
            return db
              .into('notes')
              .insert(testNotes);
          });
      });
      it('creates a note in the appropriate folder and responds with 201', () => {
        const newNote = {
          name: 'test new note', 
          folderid: 2,
          content: 'test new content',
        };
        return supertest(app)
          .post('/api/notes')
          .send(newNote)
          .expect(201)
          .expect(res => {
            expect(res.body.name).to.eql(newNote.name);
            expect(res.body.content).to.eql(newNote.content);
            expect(res.body.folderid).to.eql(testFolders[res.body.folderid - 1].id);
            expect(res.body).to.have.property('modified');
            expect(res.body).to.have.property('id');
            expect(res.headers.location).to.eql(`/${res.body.id}`);
          }) 
          .then(postRes => 
            supertest(app)
              .get(`/api/notes/${postRes.body.id}`)
              .expect(postRes.body)    
          );
      });
    });
  });
});