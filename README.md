#### How to Use
To parse a BMG file, either provide a FileSystemHandle of the .arc file to BMG.parseFileSystemHandle or either a Uint8Array or ArrayBuffer to BMG.parseArrayBuffer. For example, if you were to enable drag and drop onto your page, you could do:
```js
let dropFiles = async function(e){
  e.preventDefault();
  if(e.dataTransfer.files[0].name.match(/.bmg$/)){
    e.dataTransfer.items[0].getAsFileSystemHandle().then(BMG.parseFileSystemHandle).then(stringData=>{
      //Use the colors here
    });
  }
}
```

To create a BMG file, provide a BMG.Data object to BMG.bmgify.
```js
BMG.parseArrayBuffer(someArrayBuffer).then(stringData=>{
  let a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([BMG.bmgify(stringData)],{type:"application/octet-stream"}));
  a.download = "file.bmg";
  a.click();
});
```

The BMG.Data class has the following structure:
```js
Number BMG.Data.fileID
Number BMG.Data.defaultColor
Array  BMG.Data.strings = [
  {
    id:Number,        //This may make this Pikmin 2 exclusive
                      //If so, just fork this and remove the string ID stuff
    string:Uint8Array,
    codes:[
      {
        offset:Number,
        type:String,
        info:Number
      },
      ...
    ],
    tag:Number
  },
  ...
]
```
A code type may be any of the following:
 - image
 - colorEX
 - pause
 - speed
 - control
 - resetSpacing
 - spacing
 - resetLineHeight
 - lineHeight
 - resetHeight
 - height
 - resetWidth
 - width
 - color
 - size
 - system

If your game has any additional codes, you may fork this and add them in as needed. I've specialized for Pikmin 2, here. In Pikmin 2, system codes go unused in vanilla code and only one of them are even implemented, while the only control code is to control whether the ship's voice is fast or not. The only other code type that's not self-explanitory is colorEX, which lets you set the top and bottom colors in the text's gradient separately.

You can copy a BMG.Data object by passing one such object into its constructor.
```js
BMG.parseArrayBuffer(someArrayBuffer).then(stringData=>{
  let stringDataCopy = new BMG.Data(stringData);
});
```

The function signatures are as follows:
```js
RARC.parseFileSystemHandle(FileSystemHandle) -> Promise -> BMG.Data
RARC.parseArrayBuffer(ArrayBuffer)           -> Promise -> BMG.Data
RARC.parseArrayBuffer(Uint8Array)            -> Promise -> BMG.Data
RARC.bmgify(BMG.Data)                        -> Uint8Array
```
