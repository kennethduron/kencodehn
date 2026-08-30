import assert from "node:assert/strict";
import {mkdir,writeFile} from "node:fs/promises";
import path from "node:path";
import {chromium,firefox,webkit,type BrowserType,type Page} from "playwright";

const baseUrl="https://kencodehn.com";
const outputDir=path.resolve("test-artifacts","phase4-production-engine-qa");
const protectedRoutes=["/admin","/admin/clientes","/admin/proyectos","/admin/modulos","/admin/finanzas","/admin/finanzas/reportes"];
const forbidden=/\b(UUID|UID|RLS|Provider|Migration|Cron|Supabase|Metadata|Foreign Key|Webhook|Logs)\b/i;
const engines={chromium,webkit,firefox} satisfies Record<string,BrowserType>;
const matrices={
 chromium:[[320,844],[360,800],[375,812],[390,844],[412,915],[430,932],[768,1024],[820,1180],[1024,768],[1280,900],[1440,1000],[1920,1080],[844,390],[932,430]] as const,
 webkit:[[390,844],[844,390],[834,1194],[1194,834]] as const,
 firefox:[[390,844],[1440,1000]] as const,
};
type Finding={engine:string;viewport:string;routes:number;checks:number;screenshots:number};
const findings:Finding[]=[];

async function geometry(page:Page){return page.evaluate(()=>({width:window.innerWidth,scrollWidth:document.documentElement.scrollWidth,bodyWidth:document.body.scrollWidth}));}

await mkdir(outputDir,{recursive:true});
for(const [engine,launcher] of Object.entries(engines)){
 const browser=await launcher.launch({headless:true});
 try{
  for(const [width,height] of matrices[engine as keyof typeof matrices]){
   const context=await browser.newContext({viewport:{width,height},locale:"es-HN",timezoneId:"America/Tegucigalpa"});
   const page=await context.newPage();
   const errors:string[]=[];
   page.on("pageerror",error=>errors.push(error.message));
   page.on("response",response=>{if(response.status()>=500)errors.push(`${response.status()} ${response.url()}`);});
   let checks=0,screenshots=0;
   for(const route of protectedRoutes){
    const response=await page.goto(`${baseUrl}${route}`,{waitUntil:"domcontentloaded",timeout:60_000});
    assert.ok(response&&response.status()<400,`${engine} ${route}: HTTP ${response?.status()}`);
    await page.waitForLoadState("networkidle",{timeout:15_000}).catch(()=>undefined);
    const size=await geometry(page);
    assert.ok(size.scrollWidth<=size.width+1&&size.bodyWidth<=size.width+1,`${engine} ${width}x${height} ${route}: full-page horizontal overflow`);
    const text=await page.locator("body").innerText();
    assert.doesNotMatch(text,forbidden,`${engine} ${route}: technical terminology exposed`);
    assert.ok(await page.getByRole("heading",{name:"CRM Ken Code"}).isVisible(),`${engine} ${route}: login heading missing`);
    assert.equal(await page.locator('nav[aria-label="Navegacion principal del CRM"]').count(),0,`${engine} ${route}: private navigation leaked without a session`);
    checks+=4;
   }
   const publicResponse=await page.goto(baseUrl,{waitUntil:"domcontentloaded",timeout:60_000});
   assert.ok(publicResponse&&publicResponse.status()<400,`${engine} public home: HTTP ${publicResponse?.status()}`);
   const publicSize=await geometry(page);
   assert.ok(publicSize.scrollWidth<=publicSize.width+1&&publicSize.bodyWidth<=publicSize.width+1,`${engine} ${width}x${height}: public overflow`);
   checks+=2;
   if((engine==="chromium"&&[320,375,430,768,1440,1920].includes(width))||(engine==="webkit"&&[390,834].includes(width))||(engine==="firefox"&&width===1440)){
    await page.screenshot({path:path.join(outputDir,`${engine}-${width}x${height}-home.png`),fullPage:true,animations:"disabled"});
    screenshots+=1;
   }
   assert.deepEqual(errors,[],`${engine} ${width}x${height}: page/server errors`);
   findings.push({engine,viewport:`${width}x${height}`,routes:protectedRoutes.length+1,checks,screenshots});
   await context.close();
  }
 }finally{await browser.close();}
}

const report={status:"PASS",playwright:"1.60.0",engines:{chromium:"148.0.7778.96",webkit:"26.4",firefox:"150.0.2"},scope:"Production public rendering and unauthenticated protection; authenticated CRM inspection is performed separately with Codex Browser.",credentialsCaptured:false,sessionStatePersisted:false,hardware:false,findings};
await writeFile(path.join(outputDir,"result.json"),JSON.stringify(report,null,2),"utf8");
console.log(JSON.stringify(report,null,2));
