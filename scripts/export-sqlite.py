import json,sqlite3,sys,pathlib
p=pathlib.Path(sys.argv[1] if len(sys.argv)>1 else 'elevatehr.db').resolve()
if not p.is_file():
 print('SQLite file not found.',file=sys.stderr);sys.exit(1)
c=sqlite3.connect(p.as_uri()+'?mode=ro',uri=True)
c.row_factory=sqlite3.Row
present={r[0] for r in c.execute("SELECT name FROM sqlite_master WHERE type='table'")}
print(json.dumps({name:[dict(r) for r in c.execute('SELECT * FROM '+name)] if name in present else [] for name in ('jobs','candidates','interviews')}))
c.close()
