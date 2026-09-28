
(function(){
  const cp1252Map = {
    0x20ac:0x80,0x201a:0x82,0x192:0x83,0x201e:0x84,
    0x2026:0x85,0x2020:0x86,0x2021:0x87,0x2c6:0x88,
    0x2030:0x89,0x160:0x8a,0x2039:0x8b,0x152:0x8c,
    0x17d:0x8e,0x2018:0x91,0x2019:0x92,0x201c:0x93,
    0x201d:0x94,0x2022:0x95,0x2013:0x96,0x2014:0x97,
    0x2dc:0x98,0x2122:0x99,0x161:0x9a,0x203a:0x9b,
    0x153:0x9c,0x17e:0x9e,0x178:0x9f
  };

  function badScore(s){
    const patterns = [
      /\u00c3./g,
      /\u00c2./g,
      /\u00c6./g,
      /\u00c7./g,
      /\u00d0./g,
      /\u00d1./g,
      /\u00c4./g,
      /\u00c5./g,
      /\u00e1[\u00ba\u00bb]./g,
      /\u00e2./g,
      /\u0192/g
    ];

    let n=0;
    for(const p of patterns){
      n += (s.match(p)||[]).length;
    }
    return n;
  }

  function decodeOnce(s){
    const bytes=[];

    for(let i=0;i<s.length;i++){
      const code=s.charCodeAt(i);

      if(code<=0x7f || (code>=0xa0 && code<=0xff)){
        bytes.push(code);
      }else if(cp1252Map[code]!==undefined){
        bytes.push(cp1252Map[code]);
      }else if(code>=0x80 && code<=0x9f){
        bytes.push(code);
      }else{
        return null;
      }
    }

    try{
      return new TextDecoder("utf-8",{fatal:true})
        .decode(new Uint8Array(bytes));
    }catch(_){
      return null;
    }
  }

  function repair(s){
    let result=s;

    for(let i=0;i<5;i++){
      const candidate=decodeOnce(result);
      if(!candidate) break;

      if(badScore(candidate)<badScore(result)){
        result=candidate;
      }else{
        break;
      }
    }

    return result;
  }

  function repairTree(root){
    if(!root) return;

    const walker=document.createTreeWalker(
      root,
      NodeFilter.SHOW_TEXT
    );

    const nodes=[];

    while(walker.nextNode()){
      const node=walker.currentNode;
      const parent=node.parentElement;

      if(
        !parent ||
        parent.tagName==="SCRIPT" ||
        parent.tagName==="STYLE" ||
        parent.tagName==="NOSCRIPT"
      ) continue;

      nodes.push(node);
    }

    for(const node of nodes){
      const fixed=repair(node.nodeValue || "");
      if(fixed!==node.nodeValue){
        node.nodeValue=fixed;
      }
    }

    root.querySelectorAll("input,textarea,select,button,[title],[aria-label],[placeholder]")
      .forEach(el=>{
        for(const attr of ["title","aria-label","placeholder"]){
          if(el.hasAttribute(attr)){
            const old=el.getAttribute(attr);
            const fixed=repair(old);
            if(fixed!==old){
              el.setAttribute(attr,fixed);
            }
          }
        }
      });
  }

  let running=false;

  function refresh(){
    if(running) return;
    running=true;

    requestAnimationFrame(()=>{
      running=false;
      repairTree(document.body);
      document.title=repair(document.title);
    });
  }

  window.addEventListener("load",()=>{
    refresh();

    const observer=new MutationObserver(refresh);
    observer.observe(document.body,{
      subtree:true,
      childList:true,
      characterData:true,
      attributes:true,
      attributeFilter:["title","aria-label","placeholder"]
    });
  });
})();
