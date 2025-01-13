import Encoding from "https://cdn.jsdelivr.net/npm/encoding-japanese@2.2.0/encoding.min.js"

let BMG = {
  parseFileSystemHandle(handle){
    return new Promise(res=>{
      handle.getFile().then(f=>{
        let fr = new FileReader();
        fr.onload = ()=>BMG.parseArrayBuffer(fr.result).then(res);
        fr.readAsArrayBuffer(f);
      });
    });
  },
  parseArrayBuffer(array){
    let pointer = 40;
    let buffer = new Uint8Array(array);
    let view = new DataView(buffer.buffer);
    let entryCount = view.getUint16(pointer);
    pointer+=2;
    let entrySize = view.getUint16(pointer);
    pointer+=2;
    let fileID = view.getUint16(pointer);
    pointer+=2;
    let defaultColor = buffer[pointer];
    pointer+=2;
    let offsets = [];
    for(let i=0;i<entryCount;i++){
      entries.push(view.getUint32(pointer));
      pointer+=entrySize;
    }
    while(buffer[pointer]==0)pointer++;
    pointer+=4;
    let totalStringLength = view.getUint32(pointer);
    pointer+=4;
    let tablePointer = pointer;
    let strings = [];
    for(let o of offsets){
      let string = "";
      let start = tablePointer+o;
      let end = start;
      while(buffer[end]!=0)end++;
      strings.push(buffer.slice(start,end));
      pointer = end;
    }
    while(buffer[pointer]==0)pointer++;
    pointer+=16;
    let ids = [];
    while(buffer[pointer]){
      ids.push(view.getUint32(pointer));
      pointer+=4;
    }
    return new Promise(res=>res(new BMG.Data({fileID,defaultColor,ids,strings})));
  },
  bmgify(data){
    
  },
  Data:function({fileID=0,defaultColor=0,ids=[],strings=[]}={}){
    this.fileID = fileID;
    this.defaultColor = defaultColor;
    this.strings = [];
    let td = new TextDecoder();
    for(let [i,s] of strings.entries()){
      let id = ids[i];
      let string = "";
      let codes = [];
      let start = 0;
      let end = 0;
      while(end<s.length){
        end++;
        if(s[end]==26){
          string+=td.decode(s.slice(start,end-1));
          let pointer = end+1;
          let length = s[pointer]-2;
          pointer++;
          start = pointer+length;
          let code = s.slice(pointer,pointer+length);
          let type = code[0]==2?(
            code[2]==0?
              "pause"
            :
              "speed"
          ):code[0]==3?
            "stretch"
          :code[0]==255?(
            code[2]==1?
              "size"
            :
              "color"
          ):
            "button";
          let info = type=="pause"?
            0
          :type=="stretch"?
            code[4]
          :type=="size"?
            code[3]*256+code[4]
          :
            code[3];
          let offset = string.length;
          codes.push({offset,type,info});
        }
      }
      string+=td.decode(s.slice(start));
      string = Encoding.convert(string,{from:"SJIS",to:"UTF-8"});
      this.strings.push({id,string,codes});
    }
  }
}

export {BMG};
