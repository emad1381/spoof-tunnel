"use client";
import { useState } from "react";
import { api } from "@/lib/api";

type Tunnel = Record<string, string | number | boolean>;
function download(name: string, config: Tunnel) {
 const blob = new Blob([JSON.stringify(config,null,2)],{type:"application/json"});
 const url=URL.createObjectURL(blob); const a=document.createElement("a");a.href=url;a.download=name;a.click();URL.revokeObjectURL(url);
}
export default function PairPage(){
 const [form,setForm]=useState({engine:"tun",auto_start:true,tun_subnet:"10.77.0.0/30",name:"My tunnel",local_ip:"",remote_ip:"",local_spoof:"",remote_spoof:"",listen:"127.0.0.1:5000",forward:"127.0.0.1:51820",upload:"icmp",download:"icmp",local_port:5001,remote_port:8090,save_role:"local"});
 const [result,setResult]=useState<{local:Tunnel;remote:Tunnel;saved:Tunnel|null}|null>(null);
 const [busy,setBusy]=useState(false);const [error,setError]=useState("");
 const fields=[ ["name","نام اتصال"],["tun_subnet","شبکهٔ داخلی TUN (برای هر اتصال متفاوت)"],["local_ip","IP واقعی سرور ایران"],["remote_ip","IP واقعی سرور خارج"],["local_spoof","IP مبدأ جعلی سمت ایران"],["remote_spoof","IP مبدأ جعلی سمت خارج"],["local_port","پورت دریافت در ایران"],["remote_port","پورت دریافت در خارج"]] as const;
 const submit=async(e:React.FormEvent)=>{e.preventDefault();setError("");setBusy(true);setResult(null);try{setResult(await api.pair(form))}catch(e){setError(e instanceof Error?e.message:"خطا در ساخت تنظیمات")}finally{setBusy(false)}};
 return <div className="emad-page" dir="rtl">
 <div className="eyebrow">CONNECTION BUILDER / 02</div><h1>دو سمت، یک اتصال.</h1><p className="page-intro">تنظیمات مکمل ایران و خارج را یک‌جا بساز. جهت پروتکل‌ها و پورت‌های برگشت خودکار هماهنگ می‌شوند.</p>
 <div className="builder-grid"><form className="glass-card" onSubmit={submit}>
 <h2>مشخصات مسیر TUN</h2><p className="page-intro">ترافیک داخلی TCP، UDP و ICMP است. حامل فقط بسته‌بندی مسیر بین دو سرور را تعیین می‌کند.</p><div className="field-grid">{fields.map(([key,label])=><label key={key}>{label}<input className="input" dir="ltr" required maxLength={100} type={key.endsWith("_port")?"number":"text"} min={key.endsWith("_port")?1:undefined} max={key.endsWith("_port")?65535:undefined} value={form[key]} onChange={e=>{setResult(null);setForm({...form,[key]:key.endsWith("_port")?Number(e.target.value):e.target.value})}} placeholder={key.includes("ip")||key.includes("spoof")?"203.0.113.10":undefined}/></label>)}</div>
 <div className="field-grid">{([ ["upload","پروتکل رفت"],["download","پروتکل برگشت"]] as const).map(([key,label])=><label key={key}>{label}<select className="input" value={form[key]} onChange={e=>{setResult(null);setForm({...form,[key]:e.target.value})}}>{["icmp","tcp","udp","ipip","experimental"].map(t=><option key={t}>{t}</option>)}</select></label>)}
 <label>این پنل روی کدام سمت است؟<select className="input" value={form.save_role} onChange={e=>{setResult(null);setForm({...form,save_role:e.target.value})}}><option value="local">ایران · local</option><option value="remote">خارج · remote</option><option value="">فقط تولید تنظیمات</option></select></label></div>
 <label style={{display:"block",marginBottom:20}}><input type="checkbox" checked={form.auto_start} onChange={e=>{setResult(null);setForm({...form,auto_start:e.target.checked})}}/> شروع خودکار این اتصال با روشن‌شدن پنل</label>
 {error&&<p role="alert" className="error-banner">{error}</p>}<button className="btn btn-primary" disabled={busy||!!result}>{busy?"در حال ساخت…":result?"ذخیره شد؛ برای اتصال جدید فیلدها را تغییر بده":"ساخت تنظیمات هماهنگ ←"}</button>
 </form><aside><div className="route-card"><span className="eyebrow">PACKET ROUTE</span><div className="route-node">ایران <small dir="ltr">{form.local_ip||"LOCAL IPv4"}</small></div><div className="route-wire"><span>{form.upload.toUpperCase()} ↓ ↑ {form.download.toUpperCase()}</span></div><div className="route-node">خارج <small dir="ltr">{form.remote_ip||"REMOTE IPv4"}</small></div><p>IPهای واقعی مقصد بسته‌اند. IPهای spoof فقط در فیلد مبدأ قرار می‌گیرند.</p></div><div className="glass-card" style={{marginTop:20}}><h3>تونل لایهٔ ۳ · رمزنگاری فعال</h3><p className="page-intro">دو آدرس داخلی از شبکهٔ /30 انتخابی ساخته می‌شود. کلید مشترک تصادفی به‌صورت خودکار ساخته می‌شود. پس از ورود فایل در سمت مقابل، هر دو تونل را راه‌اندازی کن. این فایل حاوی کلید خصوصی اتصال است؛ آن را عمومی نکن. هر اتصال به نام رابط و شبکهٔ داخلی مستقل نیاز دارد.</p></div></aside></div>
 {result&&<section className="glass-card result-panel" role="status"><h2>تنظیمات آماده است</h2><p>{result.saved?"سمت انتخاب‌شده در فهرست تونل‌های همین سرور ذخیره شد. سمت دیگر را در پنل سرور مقابل وارد کن.":"هر دو تنظیمات ساخته شد؛ چیزی در سرور ذخیره نشده است."}</p><div className="field-grid">{(["local","remote"] as const).map(role=><div key={role}><h3>{role==="local"?"ایران":"خارج"} / {role}</h3><button className="btn btn-primary" onClick={()=>download(`emad-${role}.json`,result[role])}>دانلود برای پنل مقابل</button><pre dir="ltr">{JSON.stringify({...result[role],psk:"•••••••• (included in download)"},null,2)}</pre></div>)}</div></section>}
 </div>
}
