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
    let offsets = new Array(entryCount);
    let tags = new Array(entryCount);
    for(let i=0;i<entryCount;i++){
      offsets[i] = view.getUint32(pointer);
      tags[i] = (view.getUint32(pointer+4))
      pointer+=entrySize;
    }
    while(view.getUint32(pointer)!=1145132081)pointer++;//DAT1
    pointer+=4;
    let tableSize = view.getUint32(pointer)-8;
    pointer+=4;
    let tablePointer = pointer;
    let strings = [];
    for(let o of offsets){
      let string = "";
      pointer = tablePointer+o;
      let end = pointer;
      while(buffer[end]!=0){
        if(buffer[end]==26)
          end+=buffer[end+1];
        else
          end++;
      }
      strings.push(buffer.slice(pointer,end));
      pointer = end;
    }
    while(view.getUint32(pointer)!=1296647217)pointer++;//MID1
    pointer+=16;
    let ids = [];
    while(buffer[pointer+3]!==undefined){
      ids.push(view.getUint32(pointer));
      pointer+=4;
    }
    return new Promise(res=>res(new BMG.Data({fileID,defaultColor,ids,strings,tags})));
  },
  bmgify(data){
    let fileSize = 32;
    let stringSize = 1;
    let offsetTableSize = 0;
    let strings = [];
    let stringTable = [];
    
    let getOffset = function(stringArray){
      let offset = 1;
      for(let s of stringTable){
        if(s==stringArray)
          return offset;
        offset+=s.length;
        if(s.length<stringArray.length)
          continue;
        let matches = true;
        for(let i=-1;i>-stringArray.length-1;i--){
          if(stringArray.at(i)!=s.at(i)){
            matches = false;
            break;
          }
        }
        if(!matches)
          continue;
        offset-=stringArray.length;
        break;
      }
      return offset;
    }
    
    let te = new TextEncoder();
    let entrySize = 8;
    for(let s of data.strings){
      let offsets = [];
      for(let c of s.codes)
        offsets.push(c.offset);
      offsets = Array.from(new Set(offsets));
      offsets.sort((a,b)=>a<b?1:-1);
      let string = Array.from(s.string);
      for(let o of offsets){
        let cstring = string.slice(0,o);
        for(let c of s.codes){
          if(o!=c.offset)
            continue;
          let dataBytes = [];
          switch(c.type){
            case "unusedKeep":{
              dataBytes = Array.from(c.info.slice(1));
              break;
            }
            case "image":{
              dataBytes.push(0);
              dataBytes.push(0);
              dataBytes.push(Math.floor(c.info/256)%256);
              dataBytes.push(c.info%256);
              break;
            }
            case "colorEX":{
              dataBytes.push(0);
              dataBytes.push(0);
              dataBytes.push(c.info[0]);
              dataBytes.push(c.info[1]);
              break;
            }
            case "pause":
            case "speed":
            case "control":{
              dataBytes.push(2);
              dataBytes.push(0);
              dataBytes.push(c.type=="control"?2:c.type=="speed"?1:0);
              if(c.type!="pause")
                dataBytes.push(c.info);
              break;
            }
            case "resetSpacing":
            case "spacing":
            case "resetLineHeight":
            case "lineHeight":
            case "resetHeight":
            case "height":
            case "resetWidth":
            case "width":{
              dataBytes.push(3);
              dataBytes.push(0);
              switch(c.type){
                case "resetSpacing":
                case "resetLineHeight":
                case "resetHeight":
                case "resetWidth":{
                  dataBytes.push(
                    c.type=="resetSpacing"?
                      0
                    :c.type=="resetLineHeight"?
                      2
                    :c.type=="resetHeight"?
                      4
                    :
                      6
                  );
                  break;
                }
                case "spacing":
                case "lineHeight":{
                  dataBytes.push(c.type=="spacing"?1:3);
                  dataBytes.push(c.info);
                  break;
                }
                case "height":
                case "width":{
                  dataBytes.push(c.type=="height"?5:7);
                  for(let i=1;i<=2;i++)
                    dataBytes.push(Math.floor(c.info/2**(8*(2-i)))%256);
                }
              }
              break;
            }
            case "color":
            case "size":{
              dataBytes.push(255);
              dataBytes.push(0);
              dataBytes.push(c.type=="color"?0:1);
              if(c.type=="size")
                dataBytes.push(Math.floor(c.info/256)%256);
              dataBytes.push(c.info%256);
            }
          }
          cstring.push(26);
          cstring.push(dataBytes.length+2);
          cstring = cstring.concat(dataBytes);
        }
        string = cstring.concat(string.slice(o));
      }
      string.push(0);
      offsetTableSize+=entrySize;
      string = new Uint8Array(string);
      strings.push(string);
      if(getOffset(string)==stringSize){
        stringSize+=string.length;
        stringTable.push(string);
      }
    }
    fileSize+=Math.ceil((stringSize+8)/32)*32+Math.ceil((offsetTableSize+16)/32)*32+Math.ceil((strings.length*4+16)/32)*32;
    fileSize = Math.ceil(fileSize/16)*16;
    let buffer = new Uint8Array(fileSize);
    let view = new DataView(buffer.buffer);
    
    buffer.set(te.encode("MESGbmg1"),0);
    view.setUint32(8,fileSize);
    view.setUint32(12,3);
    view.setUint8(16,3);
    
    buffer.set(te.encode("INF1"),32);
    view.setUint32(36,Math.ceil(entrySize*strings.length/16+1)*16);
    view.setUint16(40,strings.length);
    view.setUint16(42,entrySize);
    view.setUint16(44,data.fileID);
    view.setUint8(46,data.defaultColor);
    
    let pointer = 48;
    for(let [i,s] of strings.entries()){
      view.setUint32(pointer,getOffset(s));
      view.setUint32(pointer+4,data.strings[i].tag);
      pointer+=entrySize;
    }
    pointer = Math.ceil(pointer/16)*16;
    
    buffer.set(te.encode("DAT1"),pointer);
    pointer+=4;
    view.setUint32(pointer,Math.ceil((stringSize+8)/32)*32);
    pointer+=4+1;
    for(let s of stringTable){
      buffer.set(new Uint8Array(s),pointer);
      pointer+=s.length;
    }
    pointer = Math.ceil(pointer/32)*32;
    
    buffer.set(te.encode("MID1"),pointer);
    pointer+=4;
    view.setUint32(pointer,Math.ceil((4*strings.length+16)/32)*32);
    pointer+=4;
    view.setUint16(pointer,strings.length);
    pointer+=2;
    view.setUint8(pointer,16);
    pointer++;
    view.setUint8(pointer,1);
    pointer+=1+4;
    
    for(let s of data.strings){
      view.setUint32(pointer,s.id);
      pointer+=4;
    }
    return buffer;
  },
  Data:function({fileID=0,defaultColor=0,ids=[],strings=[],tags=[]}={}){
    if(arguments[0] instanceof BMG.Data){
      let old = arguments[0];
      this.fileID = old.fileID;
      this.defaultColor = old.defaultColor;
      this.strings = [];
      for(let s of old.strings)
        this.strings.push({id:s.id,string:s.string,codes:s.codes,tag:s.tag});
      return;
    }
    this.fileID = fileID;
    this.defaultColor = defaultColor;
    this.strings = [];
    let td = new TextDecoder();
    for(let [i,s] of strings.entries()){
      let id = ids[i];
      let string = [];
      let codes = [];
      let start = 0;
      let end = 0;
      while(end<s.length){
        while(s[end]==26){
          string = string.concat(Array.from(s.slice(start,end)));
          let pointer = end+1;
          let length = s[pointer]-1;
          start = pointer+length;
          end = start;
          let code = s.slice(pointer,pointer+length);
          let v = new DataView(code.buffer);
          let typeBinary = v.getUint32(0);
          let byte = (typeBinary>>16)%(2**8);
          let short = typeBinary%(2**16);
          let type = "system";
          let infoBytes = code.slice(4);
          let info = 0;
          for(let [i,b] of infoBytes.entries())
            info+=b*(8**(infoBytes.length-1-i));
          if(byte<192){
            switch(byte){
              case 0:{
                type = "image";
                break;
              }
              case 1:{
                type = "colorEX";
                info = [infoBytes[0],infoBytes[1]];
                break;
              }
              case 2:{
                type = short==0?"pause":short==1?"speed":"control";
                break;
              }
              case 3:{
                switch(short){
                  case 0:{
                    type = "resetSpacing";
                    break;
                  }
                  case 1:{
                    type = "spacing";
                    break;
                  }
                  case 2:{
                    type = "resetLineHeight";
                    break;
                  }
                  case 3:{
                    type = "lineHeight";
                    break;
                  }
                  case 4:{
                    type = "resetHeight";
                    break;
                  }
                  case 5:{
                    type = "height";
                    break;
                  }
                  case 6:{
                    type = "resetWidth";
                    break;
                  }
                  case 7:{
                    type = "width";
                    break;
                  }
                  default:
                    type = "unused";
                }
                break;
              }
              default:
                type = "unused";
            }
          }else if(byte==255){
            switch(short){
              case 0:{
                type = "color";
                break;
              }
              case 1:{
                type = "size";
                break;
              }
              case 2:{
                type = "unused";
                break;
              }
              case 3:{
                type = "unused";
                break;
              }
            }
          }
          if(type=="unused"){
            continue;
          }
          if(type=="system")
            info = code;
          let offset = string.length;
          codes.push({offset,type,info});
        }
        end++;
      }
      codes = codes.reverse().filter((c,i)=>["system","image","pause"].includes(c.type) || !codes.some((o,j)=>j<i && o.offset==c.offset && o.type==c.type)).reverse();
      string = new Uint8Array(string.concat(Array.from(s.slice(start))));
      this.strings.push({id,string,codes,tag:tags[i]});
    }
  }
}
