CREATE TABLE notes (
    id INTEGER PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
    name TEXT NOT NULL,
    modified TIMESTAMP NOT NULL DEFAULT now(),
    folderid INTEGER NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
    content TEXT NOT NULL
);