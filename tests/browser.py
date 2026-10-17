"""Headless real-browser fixture, not a native installed-host certification."""
import argparse,base64,json,pathlib
from playwright.sync_api import sync_playwright
parser=argparse.ArgumentParser();parser.add_argument('--docs',required=True);parser.add_argument('--original');parser.add_argument('--output',default='context/browser');args=parser.parse_args()
ROOT=pathlib.Path(__file__).resolve().parents[1];OUT=pathlib.Path(args.output).resolve();OUT.mkdir(parents=True,exist_ok=True)
docs=json.loads(pathlib.Path(args.docs).read_text());by_path={d['path']:d['content'] for d in docs}
checks=[];errors=[]
def check(name,cond):
    checks.append({'name':name,'pass':bool(cond)});assert cond,name
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
    ctx=browser.new_context(viewport={'width':1100,'height':900})
    def route(r):
        url=r.request.url;path=url.split('https://fixture.test')[-1]
        if path=='/':
            css=':root{--lumiverse-bg:#1c1826;--lumiverse-bg-elevated:#231e30;--lumiverse-bg-hover:#2d283a;--lumiverse-border:#615171;--lumiverse-text:#f4effa;--lumiverse-text-muted:#b6acc2;--lumiverse-primary:#9370db;--lumiverse-danger:#ef4444;--background:#171421;--card:#211c2e;--border:#4a405a;--foreground:#f4effa;--card-foreground:#f4effa;--primary:#9370db;--primary-foreground:#fff;--secondary:#332b42;--secondary-foreground:#fff;--muted-foreground:#b6acc2}body{margin:0;background:var(--lumiverse-bg);color:var(--lumiverse-text);font-family:Arial,sans-serif}header{padding:24px;font-size:20px}'
            r.fulfill(content_type='text/html',body=f'<style>{css}</style><header>Docs Tutor · headless fixture (NOT installed)</header>');return
        if path.startswith('/api/v1/docs/catalog'):
            r.fulfill(json=[{'path':d['path']} for d in docs]);return
        if path.startswith('/api/v1/docs/file/'):
            encoded=path.rsplit('/',1)[1];decoded=base64.urlsafe_b64decode(encoded+'='*(-len(encoded)%4)).decode()
            r.fulfill(content_type='text/plain',body=by_path[decoded]);return
        if path.startswith('/api/characters'):
            r.fulfill(json=[{'id':'test-character','data':{'name':'초보 안내 캐릭터'}}]);return
        if path=='/api/health':r.fulfill(json={'version':'2.3.5'});return
        local=ROOT/path.lstrip('/')
        if path.endswith('.js') and local.is_file():r.fulfill(content_type='application/javascript',body=local.read_text());return
        r.abort()
    ctx.route('**/*',route)
    page=ctx.new_page();page.on('pageerror',lambda error:errors.append(str(error)))
    page.goto('https://fixture.test',wait_until='networkidle')
    page.evaluate("async()=>{const m=await import('/tests/browser-fixture.js');window.fixture=m.mountFixture();}")
    page.get_by_role('button',name='Docs Tutor 로어북 생성·장착',exact=True).click()
    page.get_by_text('초보 안내 캐릭터',exact=True).wait_for()
    check('original button, checkbox and CTA',page.get_by_role('button',name='로어북 생성 + 장착',exact=True).is_visible())
    page.locator('.mdtl-modal').screenshot(path=str(OUT/'port-fixture.png'))
    page.get_by_role('button',name='로어북 생성 + 장착',exact=True).click()
    check('empty-selection validation','최소 1개' in page.locator('.mdtl-log').inner_text())
    page.locator('.mdtl-charlist input').check();page.get_by_role('button',name='로어북 생성 + 장착',exact=True).click()
    page.wait_for_function("document.querySelector('.mdtl-log').textContent.includes('✅ 완료')",timeout=120000)
    snapshot=page.evaluate('window.fixture.snapshot()')
    check('bundled frontend to backend service completed',len(snapshot['books'])==1 and len(snapshot['entries'])>2)
    check('existing character book link retained','personal' in snapshot['characters'][0]['world_book_ids'])
    first_ids=[e['id'] for e in snapshot['entries']]
    page.get_by_role('button',name='로어북 생성 + 장착',exact=True).click()
    page.wait_for_function("!document.querySelector('[data-mdtl-run]').disabled",timeout=120000)
    second=page.evaluate('window.fixture.snapshot()')
    check('rerun does not duplicate entries',[e['id'] for e in second['entries']]==first_ids)
    page.locator('.mdtl-modal').screenshot(path=str(OUT/'port-result-fixture.png'))
    page.set_viewport_size({'width':390,'height':844})
    check('mobile no horizontal overflow',page.locator('.mdtl-modal').evaluate('(e)=>e.scrollWidth<=e.clientWidth+1'))
    bounds=page.locator('.mdtl-modal').bounding_box()
    check('mobile modal fits viewport',bounds['x']>=0 and bounds['x']+bounds['width']<=390)
    page.locator('.mdtl-modal').screenshot(path=str(OUT/'port-mobile-fixture.png'))
    page.get_by_label('닫기',exact=True).click()
    button=page.get_by_role('button',name='Docs Tutor 로어북 생성·장착',exact=True)
    before=button.bounding_box();page.mouse.move(before['x']+20,before['y']+20);page.mouse.down();page.mouse.move(100,150,steps=10);page.mouse.up()
    check('drag remembers position',page.evaluate("!!localStorage.getItem('lv-docstutor-position')"))
    page.evaluate('window.fixture.dispose()')
    check('disable removes button and modal',page.locator('.mdtl-button,.mdtl-layer').count()==0)
    page.evaluate("async()=>{const m=await import('/tests/browser-fixture.js');window.fixture=m.mountFixture();}")
    check('button position restored',abs(page.locator('.mdtl-button').bounding_box()['x']-80)<5)
    page.locator('.mdtl-button').focus();page.keyboard.press('Enter')
    check('keyboard opens modal',page.locator('.mdtl-layer').is_visible())
    page.keyboard.press('Escape');check('escape closes modal',not page.locator('.mdtl-layer').is_visible())
    page.evaluate('window.fixture.dispose()')
    if args.original:
        page.set_viewport_size({'width':1100,'height':900});page.goto('https://fixture.test',wait_until='networkidle')
        original=pathlib.Path(args.original).read_text()
        page.evaluate("source=>{const api={extension:{id:'fixture'},onCleanup:()=>{},log:{error:()=>{}},storage:{get:async()=>({}),patch:async()=>{}}};new Function('marinara',source)(api);}",original)
        page.locator('.mdtl-button').click();page.get_by_text('초보 안내 캐릭터',exact=True).wait_for()
        page.locator('.mdtl-modal').screenshot(path=str(OUT/'original-source-fixture.png'))
    check('no browser page errors',not errors)
    (OUT/'receipt.json').write_text(json.dumps({'state':'fixture-only, NOT installed','checks':checks,'pageErrors':errors,'entries':len(snapshot['entries'])},ensure_ascii=False,indent=2))
    print(json.dumps({'checks':len(checks),'passed':sum(c['pass'] for c in checks),'entries':len(snapshot['entries']),'pageErrors':errors}))
    browser.close()
