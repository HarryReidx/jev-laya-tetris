import os
import shutil

ROOT = os.path.dirname(os.path.abspath(__file__))
DIST = os.path.join(ROOT, 'netlify-dist')

if os.path.exists(DIST):
    shutil.rmtree(DIST)
os.makedirs(DIST, exist_ok=True)

# 1. Copy public files
public_dir = os.path.join(ROOT, 'public')
for f in os.listdir(public_dir):
    src = os.path.join(public_dir, f)
    dst = os.path.join(DIST, f)
    if os.path.isfile(src):
        shutil.copy2(src, dst)
        print(f"Copied public file: {f}")

# 2. Copy engine directory
engine_src = os.path.join(ROOT, 'engine')
engine_dst = os.path.join(DIST, 'engine')
shutil.copytree(engine_src, engine_dst)
print("Copied engine directory.")

# 2.5 Copy docs/assets directory if exists
docs_assets_src = os.path.join(ROOT, 'docs', 'assets')
if os.path.exists(docs_assets_src):
    docs_assets_dst = os.path.join(DIST, 'docs', 'assets')
    os.makedirs(os.path.dirname(docs_assets_dst), exist_ok=True)
    shutil.copytree(docs_assets_src, docs_assets_dst)
    print("Copied docs/assets directory.")

# 3. Create _redirects
redirects_content = """# Netlify Redirects for JEV vs LAYA Tetris Platform
# Proxy backend APIs to 172.24.0.5:8089 if reachable, or fallback to SPA
/decide          http://172.24.0.5:8089/decide       200!
/commentary      http://172.24.0.5:8089/commentary   200!
/health          http://172.24.0.5:8089/health       200!
/api/*           http://172.24.0.5:8089/api/:splat   200!
/*               /index.html                         200
"""
with open(os.path.join(DIST, '_redirects'), 'w', encoding='utf-8') as f:
    f.write(redirects_content)

# 4. Create netlify.toml
toml_content = """[build]
  publish = "."

[[redirects]]
  from = "/decide"
  to = "http://172.24.0.5:8089/decide"
  status = 200
  force = true

[[redirects]]
  from = "/commentary"
  to = "http://172.24.0.5:8089/commentary"
  status = 200
  force = true

[[redirects]]
  from = "/health"
  to = "http://172.24.0.5:8089/health"
  status = 200
  force = true

[[redirects]]
  from = "/api/*"
  to = "http://172.24.0.5:8089/api/:splat"
  status = 200
  force = true

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
"""
with open(os.path.join(ROOT, 'netlify.toml'), 'w', encoding='utf-8') as f:
    f.write(toml_content)

with open(os.path.join(DIST, 'netlify.toml'), 'w', encoding='utf-8') as f:
    f.write(toml_content)

print("Build netlify-dist completed successfully.")
