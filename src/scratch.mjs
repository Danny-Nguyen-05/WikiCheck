import fs from 'fs';

async function verify() {
  const res = await fetch("https://en.wikipedia.org/w/api.php?action=parse&page=Albert_Einstein&prop=text&format=json");
  const data = await res.json();
  const html = data.parse.text["*"];

  const supRegex = /<sup[^>]*id="(cite_ref-[^"]*)"[^>]*class="reference"[^>]*>.*?<a[^>]*href="#(cite_note-[^"]+)"[^>]*>\[(\w+)\]<\/a>.*?<\/sup>/g;
  
  let match;
  let count = 0;
  while ((match = supRegex.exec(html))) {
    count++;
    if(count < 5) {
      console.log("Sup:", match[1], match[2], match[3]);
    }
  }
  console.log("Total sups:", count);

  const liRegex = /<li\s+id="(cite_note-[^"]*)"[^>]*>.*?<\/li>/gs;
  let liCount = 0;
  while ((match = liRegex.exec(html))) {
    liCount++;
    if(liCount < 5) {
       console.log("Li:", match[1]);
       // find external
       const extMatch = match[0].match(/<a(?:[^>]*\s+)?class="(?:[^"]*\s+)?external[^"]*"[^>]*href="([^"]+)"/);
       if(extMatch) console.log(" Ext:", extMatch[1]);
    }
  }
  console.log("Total lis:", liCount);
}

verify();
