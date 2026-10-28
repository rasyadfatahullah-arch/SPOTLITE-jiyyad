const PIPED=['https://pipedapi.kavin.rocks','https://pipedapi.adminforge.de','https://api.piped.projectsegfau.lt'];
const LYR='https://lrclib.net/api/search';
let songs=[],idx=-1,playing=false,player,ready=false,lyrData=[],lyrIdx=-1,tmr,trackTmr;

const $=id=>document.getElementById(id);
const content=$('content');

/* YouTube init */
function onYouTubeIframeAPIReady(){
player=new YT.Player('yt',{height:'1',width:'1',videoId:'',
playerVars:{autoplay:0,controls:0,disablekb:1,fs:0,modestbranding:1,rel:0},
events:{onReady:()=>ready=true,onStateChange:e=>{
if(e.data===YT.PlayerState.PLAYING){playing=true;upd();startTrack()}
else if(e.data===YT.PlayerState.PAUSED||e.data===YT.PlayerState.ENDED){playing=false;upd()}
}}});
}

/* Search */
function vid(url){const m=url.match(/v=([^&]+)/);return m?m[1]:null}

async function ytSearch(q){
for(const i of PIPED){
try{
const r=await fetch(`${i}/search?q=${encodeURIComponent(q)}&filter=videos`);
if(r.ok){const d=await r.json();return d.items.map(x=>({
id:vid(x.url),title:x.title,artist:x.uploaderName,thumb:x.thumbnail
})).filter(x=>x.id)}
}catch(e){}
}
throw new Error('Semua Piped gagal');
}

async function doSearch(q){
content.innerHTML='<div class="empty">Mencari...</div>';
try{
const r=await ytSearch(q);
if(!r.length){content.innerHTML='<div class="empty">Tidak ditemukan.</div>';return}
render(`Hasil: "${q}"`,r);
}catch(e){content.innerHTML=`<div class="empty">${e.message}</div>`}
}

$('searchInput').addEventListener('input',e=>{
clearTimeout(tmr);
const q=e.target.value.trim();
if(!q){loadHome();return}
if(q.length>1)tmr=setTimeout(()=>doSearch(q),600);
});

function focusSearch(){$('searchInput').focus()}
function searchAndPlay(q){$('searchInput').value=q;doSearch(q)}

async function loadHome(){
$('searchInput').value='';
content.innerHTML='<div class="empty">Memuat...</div>';
try{
const r=await fetch(`${PIPED[0]}/trending?region=ID`);
if(r.ok){
const d=await r.json();
const s=d.map(x=>({id:vid(x.url),title:x.title,artist:x.uploaderName,thumb:x.thumbnail})).filter(x=>x.id);
render('Trending Indonesia',s);
return;
}
}catch(e){}
try{const s=await ytSearch('top hits 2025');render('Top Hits',s)}
catch(e){content.innerHTML='<div class="empty">Gagal memuat.</div>'}
}

function render(title,list){
const sec=document.createElement('div');
sec.innerHTML=`<div class="ttl">${title}</div><div class="grid">
${list.map(s=>`
<div class="card" onclick="playFromList(${list.indexOf(s)})">
<div class="cimg">
<img src="${s.thumb}" loading="lazy" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' viewBox=\\'0 0 100 100\\'><rect fill=\\'#282828\\' width=\\'100\\' height=\\'100\\'/></svg>'">
<div class="cplay" onclick="event.stopPropagation();playFromList(${list.indexOf(s)})"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></div>
</div>
<div class="ctitle">${s.title}</div>
<div class="cart">${s.artist}</div>
</div>`).join('')}
</div>`;
content.appendChild(sec);
window._list=list;
}

function playFromList(i){
if(!window._list)return;
songs=window._list;
play(i);
}

/* Playback */
function play(i){
if(i<0||i>=songs.length)return;
idx=i;
const s=songs[i];
$('pImg').src=s.thumb;
$('pTtl').textContent=s.title;
$('pArt').textContent=s.artist;
if(ready&&player.loadVideoById){
player.loadVideoById(s.id);
playing=true;upd();startTrack();
fetchLyr(s.title,s.artist);
}else alert('Player belum siap.');
}

function togglePlay(){
if(!ready||idx<0)return;
if(playing)player.pauseVideo();else player.playVideo();
playing=!playing;upd();
}
function upd(){
$('iPlay').style.display=playing?'none':'block';
$('iPause').style.display=playing?'block':'none';
}
function next(){if(songs.length)play((idx+1)%songs.length)}
function prev(){if(songs.length)play((idx-1+songs.length)%songs.length)}

function seek(e){
const r=document.querySelector('.pbarBg').getBoundingClientRect();
const p=(e.clientX-r.left)/r.width;
if(ready&&player.getDuration)player.seekTo(p*player.getDuration(),true);
}

function fmt(s){if(isNaN(s)||s<0)return'0:00';const m=Math.floor(s/60),x=Math.floor(s%60);return m+':'+(x<10?'0':'')+x}

function startTrack(){
if(trackTmr)clearInterval(trackTmr);
trackTmr=setInterval(()=>{
if(ready&&player.getCurrentTime){
const c=player.getCurrentTime(),d=player.getDuration();
if(d>0){
$('pFill').style.width=(c/d*100)+'%';
$('cTime').textContent=fmt(c);
$('tTime').textContent=fmt(d);
syncLyr(c);
}
}
},500);
}

/* Lyrics */
async function fetchLyr(t,a){
$('lyrTtl').textContent=t;
$('lyrArt').textContent=a;
$('lyrBody').innerHTML='<div class="empty">Memuat lirik...</div>';
lyrData=[];lyrIdx=-1;
try{
const r=await fetch(`${LYR}?q=${encodeURIComponent(t+' '+a)}`);
const d=await r.json();
let sync=null;
for(const x of d){if(x.syncedLyrics){sync=x.syncedLyrics;break}}
if(!sync){
for(const x of d){if(x.plainLyrics){renderPlain(x.plainLyrics);return}}
$('lyrBody').innerHTML='<div class="empty">Lirik tidak ditemukan.</div>';return;
}
lyrData=parseLRC(sync);
renderSync();
}catch(e){$('lyrBody').innerHTML='<div class="empty">Gagal memuat.</div>'}
}

function parseLRC(s){
const r=[],re=/\[(\d{2}):(\d{2})\.(\d{2,3})\]/;
for(const l of s.split('\n')){
const m=l.match(re);
if(m){
const t=parseInt(m[1])*60+parseInt(m[2])+parseInt(m[3].padEnd(3,'0'))/1000;
const x=l.replace(re,'').trim();
if(x)r.push({t,x});
}
}
return r;
}

function renderSync(){
$('lyrBody').innerHTML=lyrData.map((l,i)=>
`<div class="lyrLine" id="ln${i}" onclick="seekLyr(${l.t})">${l.x}</div>`
).join('');
lyrIdx=-1;
}

function renderPlain(p){
$('lyrBody').innerHTML=p.split('\n').filter(l=>l.trim()).map(l=>`<div class="lyrLine">${l}</div>`).join('');
}

function syncLyr(c){
if(!lyrData.length)return;
let n=-1;
for(let i=0;i<lyrData.length;i++){if(c>=lyrData[i].t)n=i;else break}
if(n!==lyrIdx){
if(lyrIdx>=0){const o=$('ln'+lyrIdx);if(o)o.classList.remove('active')}
if(n>=0){const e=$('ln'+n);if(e){e.classList.add('active');e.scrollIntoView({behavior:'smooth',block:'center'})}}
lyrIdx=n;
}
}

function seekLyr(t){if(ready&&player.seekTo)player.seekTo(t,true)}
function toggleLyrics(){$('lyrPanel').classList.toggle('active')}

/* Init */
loadHome();
