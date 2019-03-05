// MICROTALK is written in 100 lines of Javascript
// can be tested in http://lambdaway.free.fr/lambdaspeech/?view=microtalk

var update = function() {
  var input = document.getElementById('input').value;
  // MICROTALK waits for curly braces in the page's code,
  // to prevent conflicts with LAMBDATALK,
  // we write round braces in the console
  // automatically replaced by curly braces in the following.
  input = input.replace( /\(/g, "{" ).replace( /\)/g, "}" ); 
  var bal = MICROTALK.balance( input );
  document.getElementById('infos').innerHTML = "["+bal.left+"|"+bal.right+"]";
  if (bal.right === bal.left)
    document.getElementById('output').innerHTML = MICROTALK.evaluate( input ).val  
}; 

var MICROTALK = (function() {
  var DICT = {}, 
      LAMB_num = 0;
  var evaluate = function(s) {
    var bal = balance(s);
    if (bal.left === bal.right) {
      s = preprocessing(s);
      s = eval_special_forms(s);
      s = eval_forms(s);
      s = postprocessing(s);
    } 
    return { val: s, bal: bal };
  };
  var eval_forms = function(s) {
    var regexp = /\{([^\s{}]*)(?:[\s]*)([^{}]*)\}/g;
    while (s !== (s = s.replace(regexp, eval_form)));
    return s;
  };
  var eval_form = function() {
    var f = arguments[1] || "", r = arguments[2] || "";
    return DICT.hasOwnProperty(f)
      ? DICT[f].apply(null, [r]) // apply f on r
      : "[" + f + " " + r + "]"; // display [f r] unevaluated
  };
  var eval_special_forms = function(s, flag) {
    while (s !== (s = form_replace(s, "lambda", eval_lambda))) ;
    while (s !== (s = form_replace(s, "def",    eval_def, flag))) ;
    return s;
  };
  var eval_lambda = function(s) { 
    s = eval_special_forms(s);
    var index = s.indexOf("}"), // "{"
        argStr = supertrim(s.substring(1, index)),
        args = argStr === "" ? [] : argStr.split(" "),
        body = s.substring(index + 2).trim(),
        ref  = "_LAMB_" + LAMB_num++;
    DICT[ref] = function() {
      var valStr = supertrim(arguments[0]);
      var vals = valStr === "" ? [] : valStr.split(" ");
      return (function(bod) {
        if (vals.length < args.length) { 
          // memorize given values and return a function waiting for missing
          for (var i = 0; i < vals.length; i++)
            bod = bod.replace(RegExp(args[i], "g"), vals[i]);
          var _args_ = args.slice(vals.length).join(" ");
          bod = eval_lambda("{" + _args_ + "} " + bod);
        } else if (vals.length === args.length) {
          // values replace arguments occurences in body
          for (var i=0; i < args.length; i++)
            bod = bod.replace( RegExp(args[i], "g"), vals[i] );
        } else {  
          // extra values are gathered in the last one
          var _vals_ = vals.slice(0,args.length);
          _vals_[args.length-1] = 
          vals.slice(args.length-1,vals.length).join(' ');
          for (var i=0; i < args.length; i++)
            bod = bod.replace( RegExp(args[i], "g"), _vals_[i] ); 
        }
        return eval_forms(bod);
      })(supertrim(body));
    };
    return ref;
  };
  var eval_def = function(s, flag) { 
    s = eval_special_forms(s, false);
    flag = (flag === undefined);
    var index = s.search(/\s/),
        name = s.substring(0, index).trim(),
        body = s.substring(index).trim();
    DICT[name] = (body.substring(0, 6) === "_LAMB_") ?
      DICT[body] : function() { return eval_forms(body) };
    return flag ? name : "";
  };
  var form_replace = function(str, sym, func, flag) {
    sym = "{" + sym + " ";
    var s = catch_form(sym, str);
    return s === "none" ? str : str.replace(sym + s + "}", func(s, flag));
  };
  var catch_form = function(symbol, str) {
    var start = str.indexOf(symbol), index = start, nb = 1;
    if (start == -1) return "none";
     while (nb > 0) {
      index++;
      if (str.charAt(index)      == "{") nb++;
      else if (str.charAt(index) == "}") nb--;
    }
    return str.substring(start + symbol.length, index);
  };
  var balance = function(s) {
    var left = s.match(/\{/g),
        right = s.match(/\}/g);
    left = left ? left.length : 0;
    right = right ? right.length : 0;
    return { left, right };
  };
  var supertrim = function(s) { return s.trim().replace(/\s+/g, " ") };
  var preprocessing = function(s)  { LAMB_num = 0; return s; };
  var postprocessing = function(s) { LAMB_num = 0; return s; };

  return {
    balance,
    evaluate 
  };

})();

// 3. adding primitives

// Adding some primitives taking benefit of JS arithmetic could help, for instance with this set ['-','*','zero?']

MICROTALK.DICT['-'] = function() {
  var args = arguments[0].split(' ');
  return Number(args[0]) - Number(args[1])
};
MICROTALK.DICT['*'] = function() {
  var args = arguments[0].split(' ');
  return Number(args[0]) * Number(args[1])
};
MICROTALK.DICT['zero?'] = function() {
  var args = arguments[0].trim();
  return (args === '0')? '[' : ']'
};

/*
we can build the factorial function:
(def FAC
 (lambda (:n)
  (((zero? :n)
   (□ (lambda (:n) 1)
      (lambda (:n) (* :n (FAC (- :n 1))) ))) :n)))

(FAC 6)
-> 720

and so on.
*/
