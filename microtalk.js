var MICROTALK = (function() {
/*
  MICROTALK by Alain Marty | updated on 2016/02/15
  http://epsilonwiki.free.fr/alphawiki_2/?view=microtalk
  microtalk is made of expressions:

    - an expression is made of words and/or forms:
    - a word is a sequence of chars except spaces and {}
    - a form is an expression {first rest} where:
    -- first is a word belonging to a dictionary,
    -- rest is an expression.
    - the dictionary contains words associated to:
    -- primitive functions written in Javascript for HTML/CSS, Math, SVG, ...
    -- user functions   {lambda {:word*} expressions},
    -- user definitions {def word expression}.
*/
/////////////////////////////////////////////////////////////////////////////
var dict     = {}; // primitive JS functions
var g_cons   = {}; // user conses
var g_lambda_num = 0;
var g_cons_num   = 0;

/////////////////////////////////////////////////////////////////////////////
var evaluate = function( str ) {
  var t0 = new Date().getTime();
  var bal = balance( str );          // {} balance control
  if (bal.left != bal.right)
    str = 'none';
  else {
    str = pre_processing(str);
    str = eval_special_forms( str ); // handle def, lambda, if, let, q, '
    str = eval_simple_forms( str );  // and evaluate {first rest}
    str = post_processing(str);
  }
  var t1 = new Date().getTime();
  return {val:str, bal:bal, time:t1-t0};
};
/////////////////////////////////////////////////////////////////////////////
var debug = false;
var loop_rex = /\{([^\s{}]*)(?:[\s]*)([^{}]*)\}/g;  // regexp sliding window
var eval_simple_forms = function( str ) { // from sequences words and forms
  var index = 0, trace = 'TRACE\n';
  while (str != (str = str.replace( loop_rex, do_apply )))
    if (debug) trace += index++ + ': ' + str + '\n';
  if (debug) console.log( trace );
  return str;                        // ... to sequences of words (and HTML)
};
var do_apply = function () {
  var first = arguments[1] || '', rest  = arguments[2] || '';
  if (dict.hasOwnProperty( first ))        // first belongs to the dictionary
     return dict[ first ].apply( null, [rest] );
  else
     return '(' + first + ' ' + rest + ')'      // {} -> ()
};

/////////////////////////////////////////////////////////////////////////////
var eval_special_forms = function( str ) {
  str = eval_apos( str );    // preventing evaluation
  str = eval_quotes( str );  // preventing evaluation
  str = eval_ifs( str );     // preventing terms evaluation
  str = eval_lets( str );    // defining local variables
  str = eval_lambdas( str ); // user anonymous functions
  str = eval_defs( str );    // user names   
  return str;
};
// special form {def name body}
var eval_defs = function( str, flag ) {  // catch {def name body}
  flag = (flag === undefined)? true : false;
  while (true) {
    var s = catch_sexpression( '{def ', str );
    if (s === 'none') break;
    str = str.replace( '{def '+s+'}', eval_def( s.trim(), flag ) );
  }
  return str;
};
var eval_def = function (s, flag) {	   // name body
  s = eval_defs( s, false );           // nested defs
  var name = s.substring(0, s.indexOf(' ')).trim(),
      body = s.substring(s.indexOf(' ')).trim(); 
  body = supertrim(body);
  if (dict.hasOwnProperty(body)) {
    dict[name] = dict[body];
    delete dict[body];
  } else { 
    dict[name] = function() { return body };
  }
  return (flag)? name : ''; //return '';
};
// special_form {lambda {:args*} body}
var eval_lambdas = function( str ) { // catch {lambda {:args*} body}
  while (true) {
    var s = catch_sexpression( '{lambda ', str );
    if (s === 'none') break;
    str = str.replace( '{lambda '+s+'}', eval_lambda(s.trim()) );
  }
  return str;
};
var eval_lambda = function (s) {   // {:args*} body
  s = eval_lambdas( s );           // nested lambdas
  var name = 'lambda_' + g_lambda_num++,
      args = supertrim( s.substring(1, s.indexOf('}')) ).split(' '),
      body = supertrim( s.substring(s.indexOf('}')+1) );
  for (var reg_args=[], i=0; i < args.length; i++)
    reg_args[i] = RegExp( args[i], 'g');

  dict[name] = function () {
    var vals = supertrim(arguments[0]).split(' ');
    return function (bod) {
      if (vals.length < args.length) {
        for (var i=0; i < vals.length; i++)
          bod = bod.replace( reg_args[i], vals[i] );
          var _args = args.slice(vals.length).join(' ');
          bod = eval_lambda( '{' + _args + '}' + bod ); 
      } else { // vals.length >= args.length, ignore extra values
        for (var i=0; i < args.length; i++) 
          bod = bod.replace( reg_args[i], vals[i] );
      }
      return bod;
    }(body);
  };
  return name;
};
// special form {let { {:arg val}* } body} 
// which is a syntaxic sugar to {{lambda {:arg*} body} val*} 
var eval_lets = function( str ) {  // catch {let { {arg val}* } body}
  while (true) {
    var s = catch_sexpression( '{let ', str );
    if (s === 'none') break;
    str = str.replace( '{let '+s+'}', eval_let(s.trim()) );
  }
  return str;
};
var eval_let = function (s) {     // { {arg val}* } body
  s = eval_lets( s );             // nested lets
  s = supertrim( s );
  var varvals = catch_sexpression( '{', s );
  var body = supertrim( s.replace( varvals, '' ) );
  varvals = varvals.substring(1, varvals.length-1);
  var avv = [], i=0;
  while (true) {
    avv[i] = catch_sexpression( '{', varvals );
    if (avv[i] === 'none') break;
    varvals = varvals.replace( avv[i], '' );
    i++;
  } 
  for (var one ='', two='', i=0; i<avv.length-1; i++) {
    var index = avv[i].indexOf( ' ' );
    one += avv[i].substring( 1, index ) + ' ';
	two += avv[i].substring(index+1, avv[i].length-1) + ' ';
  }
  return '{{lambda {'+ one + '} ' + body + '} ' + two + '}';
};
// the three following special forms are simply catched and quoted
// special form {if bool then one else two}
var eval_ifs = function( str ) { // catch {if bool then one else two}
  while (true) {
    var s = catch_sexpression( '{if ', str );
    if (s === 'none') break;
    str = str.replace( '{if '+s+'}', eval_if( s.trim() ) );
  }
  return str;
};
var eval_if = function( s ) {      // bool then one else two
  s = eval_ifs( s );               // nested ifs
  return '{when ' + quote(s) + '}';
};
// special form '{first rest}
var eval_apos = function( str ) {    // catch and escape '{first rest}
  while (true) {
    var s = catch_sexpression( "'{", str );
    if (s === 'none') break;
    str = str.replace( "'"+s, quote( s.trim() ) );
  }
  return str;
};
// special form {q {first rest}* }
var eval_quotes = function( str ) {  // catch and escape {q {first rest}* }
  while (true) {
    var s = catch_sexpression( '{q ', str );
    if (s === 'none') break;
    str = str.replace( '{q '+s+'}', quote( s.trim() ) );
  }
  return str;
};

/////////////////////////////////////////////////////////////////////////////
var pre_processing = function( str ) {
  g_lambda_num = 0;
  g_cons_num   = 0;
  str = str.trim() 
           .replace( /°°°[\s\S]*?°°°/g, '' ); // delete °°° comments °°°
//         .replace( /<=/g, '__lte__' )       // prevent "<=" broken in "< ="
//         .replace( /<([^<>]*)>/g, '< $1>' ) // breaks HTML < tags>
//         .replace( /__lte__/g, '<=' );      // retrieve the "<=" operator
  str = switch_quote( str, true );     // hide braces between °° .. .. °°
  return str;
};
var post_processing = function( str ) {
  str = switch_quote( str, false ); // show braces escaped by °° .. .. °°
  g_lambda_num = 0; // lambdas are added to dict
  g_cons_num = 0;
  for (var key in g_cons)
    delete g_cons[key]
  return str;
};
var supertrim = function (str) {
  return str.trim().replace(/\s+/g, ' ')
};
var balance = function ( str ) {
  var acc_strt    = str.match( /\{/g ), 
      acc_stop    = str.match( /\}/g ), 
      nb_acc_strt = (acc_strt)? acc_strt.length : 0,
      nb_acc_stop = (acc_stop)? acc_stop.length : 0;
  return {left:nb_acc_strt, right:nb_acc_stop}; 
};
var catch_sexpression = function( symbol, str ) {
  var start = str.indexOf( symbol );
  if (start == -1) return 'none';
  var d0, d1, d2;
  if (symbol === "'{")     { d0 = 1; d1 = 1; d2 = 1; } 
  else if (symbol === "{") { d0 = 0; d1 = 0; d2 = 1; } 
  else                     { d0 = 0; d1 = symbol.length; d2 = 0; }
  var nb = 1, index = start+d0;
  while(nb > 0) {
    if (index > 10000) { // debug, prevent an infinite loop
      console.log( 'trouble with catch_sexpression!' ); 
      return 'none';
    }
    index++;
         if ( str.charAt(index) == '{' ) nb++;
    else if ( str.charAt(index) == '}' ) nb--;
  }
  return str.substring( start+d1, index+d2 );
};
var quote = function( s ) { // deactivate s-exprs
  return s.replace( /\{/g, '&#123;' ).replace( /\}/g, '&#125;' );
};
var unquote = function( s ) { // reactivate s-exprs
  return s.replace(/&#123;/g, '{').replace(/&#125;/g, '}') 
};
var switch_quote = function ( str, flag ) { // °° some text °°
  // braces are hidden in pre-processing and showed in post-processing
  var tab = str.match( /°°[\s\S]*?°°/g );
  if (tab == null) return str;
  for (var i=0; i< tab.length; i++) {
    str = str.replace( tab[i], ((flag)? 
      quote(tab[i]) : unquote(tab[i]) ));
  }
  str = str.replace( /°°/g, '' );
  return str;
};

/////////////////////////////////////////////////////////////////////////////
// POPULATING THE DICTIONARY
/*
   dict[op] = function() {    // arguments = [rest]
     var args = arguments[0]; // rest
     ...
     return a_string
   };
*/

dict['debug'] = function() {
  var args = arguments[0]; // true|false
  debug = (args === 'true')? true : false;
  return ''
};

dict['lib'] = function () { // {lib} -> list the functions in dict
  var str = '', index = 0;
  for (var key in dict) {
    if(dict.hasOwnProperty(key)){
      str += key + ', ';
      index++;
    }
  }
  return '<b>dictionary: </b>(' + 
         index + ') [ ' + str.substring(0,str.length-2) + ' ]<br /> ';
};

dict['when'] = function () { // twinned with {if ...} in eval_ifs()
  var s = supertrim(arguments[0]);
  var index1 = s.indexOf( 'then' ),
      index2 = s.indexOf( 'else' ),
      bool = s.substring(0,index1).trim(),
      one = s.substring(index1+5,index2).trim(),
      two = s.substring(index2+5).trim();
  return (eval_simple_forms(unquote(bool)) === "true")?
          unquote(one) : unquote(two);
};

// HTML & SVG TAGS
dict['@'] = function () { return '@@' + arguments[0] + '@@' };
var htmltags = 
['div','span','a','ul','ol','li','dl','dt','dd','table','tr','td','br','hr',
'h1','h2','h3','h4','h5','h6','p','b','i','u','pre','center','blockquote',
'sup','sub','del','code','img','textarea','canvas','audio','video','source',
'svg','line','rect','circle','polyline','path','text',
'g','animateMotion','mpath','use','textPath'];
for (var i=0; i< htmltags.length; i++) {
  dict[htmltags[i]] = function(tag) {
    return function() {
      var attr = arguments[0].match( /@@[\s\S]*?@@/ ); 
      if (attr == null) 
        return '<'+tag+'>'+arguments[0]+'</'+tag+'>';
      arguments[0] = arguments[0].replace( attr[0], '' ).trim();
      attr = attr[0].replace(/^@@/, '').replace(/@@$/, '');
      return '<'+tag+' '+attr+'>'+arguments[0]+'</'+tag+'>';
    }
  }(htmltags[i]); 
}

// JS MATH OBJECT FUNCTIONS
var mathtags = // one argument
['abs','acos','asin','atan', 'atan2', 'ceil','cos','exp', 
'floor','log','random','round','sin','sqrt','tan'];
for (var i=0; i< mathtags.length; i++) {
  dict[mathtags[i]] = Math[mathtags[i]]
}

// two or more arguments
dict['pow'] = function () { 
  var args = arguments[0].split(' ');
  return Math.pow(parseFloat(args[0]),parseFloat(args[1])) 
};
dict['min'] = function () { 
  var args = arguments[0].split(' ');
  return Math.min.apply(Math, args);
};    
dict['max'] = function () { 
  var args = arguments[0].split(' ');
  return Math.max.apply(Math, args);
};    
dict['PI'] = function () { return Math.PI };
dict['E'] = function ()  { return Math.E };

// BASIC ARITHMETIC OPERATORS made variadic, ie. {* 1 2 3 4 5 6} -> 720
dict['+'] = function() { 
  var args = arguments[0].split(' ');
  if (args.length == 2) return Number(args[0]) + Number(args[1]);
  for (var r=0, i=0; i< args.length; i++) 
    r += Number(args[i]); 
  return r; 
};
dict['*'] = function() { 
  var args = arguments[0].split(' ');
  if (args.length == 2) return args[0] * args[1];
  for (var r=1, i=0; i< args.length; i++)
    if (args[i] !== '') 
      r *= args[i]; 
  return r; 
};
dict['-'] = function () { // (- 1 2 3 4) -> 1-2-3-4
  var args = arguments[0].split(' ');
  if (args.length == 2) return args[0] - args[1];
  var r = args[0];
  if (args.length == 1) 
    r = -r;  // case (- 1) -> -1
  else
    for (var i=1; i< args.length; i++) 
      r -= args[i]; 
  return r; 
};
dict['/'] = function () { // (/ 1 2 3 4) -> 1/2/3/4
  var args = arguments[0].split(' ');
  if (args.length == 2) return args[0] / args[1];
  var r = args[0];
  if (args.length == 1) 
    r = 1/r;  // case (/ 2) -> 1/2
  else
    for (var i=1; i< args.length; i++)
      if (args[i] !== '') 
        r /= args[i]; 
  return r; 
};
dict['%']  = function() { 
  var args = arguments[0].split(' '); 
  return parseFloat(args[0]) % parseFloat(args[1]) 
};

// BOOLEANS
dict['>'] = function() {
  var terms = arguments[0].split(' '); 
  return (parseFloat(terms[0]) > parseFloat(terms[1]))? 'true' : 'false'; 
};
dict['<'] = function() { 
  var terms = arguments[0].split(' '); 
  //return parseFloat(terms[0]) < parseFloat(terms[1]) 
  return (parseFloat(terms[0]) < parseFloat(terms[1]))? 'true' : 'false'; 
};
dict['='] = function() { 
  var terms = arguments[0].split(' '); 
  var a = parseFloat(terms[0]), b = parseFloat(terms[1]); 
  return (!(a < b) && !(b < a))? 'true' : 'false'; 
};
dict['not'] = function () { 
  return (arguments[0] === 'true') ? 'false' : 'true';
};
dict['or'] = function () {
  var terms = arguments[0].split(' '); 
  for (var ret='false', i=0; i< terms.length; i++)
    if (terms[i] == 'true')
      return 'true';
  return ret;
};
dict['and'] = function () { // (and (= 1 1) (= 1 2)) -> false 
  var terms = arguments[0].split(' '); 
  for (var ret='true', i=0; i< terms.length; i++)
    if (terms[i] == 'false')
      return 'false';
  return ret;
};

// SOME OTHERS
dict['serie'] = function () { // {serie start end step}
  var args = supertrim(arguments[0]).split(' ');
  var start = parseFloat( args[0] ),
      end  = parseFloat( args[1] ),
      step = parseFloat( args[2] || 1 ),
      str  = '';
  if (start < end && step > 0) {
    for (var i=start; i <= end; i+= step) 
      str += i + ' ';
  } else if (start > end && step < 0) {
    for (var i=start; i >= end; i+= step) 
      str += i + ' ';
  } else 
    str = 'start, end and step are non compatible! ';
  return str.substring(0, str.length-1);
};
dict['map'] = function () { // {map func serie}
  var args = supertrim(arguments[0]).split(' ');
  var func = args.shift();
  dict['map_temp'] = dict[func]; // if it's a lambda it's saved in map_temp
  for (var str='', i=0; i< args.length; i++)
    str += dict['map_temp'].call( null, args[i] ) + ' ';
  delete dict['map_temp'];       // clean map_temp
  return str.substring(0, str.length-1);
};
dict['reduce'] = function () { // {reduce *userfunc* serie}
  var args = supertrim(arguments[0]).split(' ');
  var func = args.shift();
  var res = '{{' + func + ' ' + args[0] + '}';
  for (var i=1; i< args.length-1; i++)
    res = '{' + func + ' ' + res + ' ' + args[i] + '}';
  res += ' ' + args[args.length-1] + '}';
  return res;
};

dict['date'] = function () { 
  var now = new Date();
  var year    = now.getFullYear(), 
      month   = now.getMonth() + 1, 
      day     = now.getDate(),
      hours   = now.getHours(), 
      minutes = now.getMinutes(), 
      seconds = now.getSeconds();
  if (month<10) month = '0' + month;
  if (day<10) day = '0' + day;
  if (hours<10) hours = '0' + hours;
  if (minutes<10) minutes = '0' + minutes;
  if (seconds<10) seconds = '0' + seconds;
  return year+' '+month+' '+day+' '+hours+' '+minutes+' '+seconds;
};  

dict['eval'] = function() { // {eval hidden expression}
  var args = supertrim(arguments[0]); 
  return unquote( args ); 
};

// SENTENCES first, rest, nth, length
dict['first'] = function () { // {first a b c d} -> a
  var args = arguments[0].split(' ');
  return args[0];
}
dict['rest'] = function () { // {rest a b c d} -> b c d
  var args = arguments[0].split(' ');
  return args.slice(1).join(' ');
}
dict['nth'] = function () { // {nth 1 a b c d} -> b
  var args = arguments[0].split(' ');
  return args[args.shift()];
}
dict['length'] = function () { // {length a b c d} -> 4
  var args = arguments[0].split(' ');
  return args.length;
}

// STRINGS equal?, empty?, chars, charAt
dict['equal?'] = function() { // {equal? word1 word2}
  var args = supertrim(arguments[0]).split(' '); 
  //return (args[0] === args[1])? 'true' : 'false'; 
  return (args[0] === args[1]) 
};

dict['empty?'] = function() { // {empty? string}
  return arguments[0] === ''; 
};
dict['chars'] = function() {  // {chars some text}
  return arguments[0].length; 
};
dict['charAt'] = function() { // {charAt i some text}
  var terms = arguments[0].split(' '), // ["i","some","text"]
      i = terms.shift(),
      s = terms.join(' ');
  return s.charAt(parseInt(i)); 
};

// CONS CAR CDR LIST
// var g_cons  = {}, g_cons_num = 0;
// testing ( z.substring(0,5) === 'cons_' ) is faster than
// testing ( g_cons.hasOwnProperty(z) )

dict['cons'] = function () { // {cons 12 34} -> cons_123
  var args = supertrim(arguments[0]).split(' ');
  var name = 'cons_' + g_cons_num++; // see eval_special_forms()
  g_cons[name] = function(w) { return (w === 'true')? args[0] : args[1] };
  return name;
};
dict['cons?'] = function () { // {cons? z}
  var z = arguments[0];
  return ( z.substring(0,5) === 'cons_' )? 'true' : 'false';
};
dict['car'] = function () { // {car z}
  var z = arguments[0];
  return ( z.substring(0,5) === 'cons_' )? g_cons[z]('true') : z;
};
dict['cdr'] = function () { // {cdr z}
  var z = arguments[0];
  return ( z.substring(0,5) === 'cons_' )? g_cons[z]('false') : z;
};
dict['cons.disp'] = function () { // {cons.disp {cons a b}} 
  var args = supertrim(arguments[0]);
  var r_cons_disp = function (z) {
    if ( z.substring(0,5) === 'cons_' )
      return '(' + r_cons_disp( g_cons[z]('true') ) + ' ' 
                 + r_cons_disp( g_cons[z]('false') ) + ')';
    else
      return z;
  };
  return r_cons_disp( args );
};

dict['list.length'] = function () {
  var args = arguments[0];
  var rlength = function (z,n) {
    return (z === 'nil')? n : rlength(g_cons[z]('false'), n+1);
  };
  return foo(args,0);
};

dict['list.new'] = function () {  // {list.new 12 34 56 78} -> cons_123
  var args = supertrim(arguments[0]).split(' '); // [12,34,56,78]
  var r_list_new = function (arr) {
    if (arr.length === 0)
      return 'nil';
    else
      return '{cons ' + arr.shift() + ' ' + r_list_new( arr ) + '}';
  };
  if (args.length === 1 && args[0] === '') {
    var name = 'cons_' + g_cons_num++;
    g_cons[name] = function(w) { return (w === 'true')? '' : 'nil' };
    return name;
  } else
    return r_list_new( args );
};

dict['list.disp'] = function () {  // {list.disp {list.new 12 34 56 78}}
  var args = arguments[0];
  var r_list_disp = function (z) {
    if (z === 'nil')
      return '';
    else
      return g_cons[z]('true') + ' ' + r_list_disp( g_cons[z]('false') );
  };
  if ( args.substring(0,5) !== 'cons_' )
    return args
  else
    return '(' + supertrim( r_list_disp( args.split(' ') ) ) + ')';
};

dict['list.last'] = function () {
  var r_last = function(z) {
    if (g_cons[z]('false') !== 'nil') 
      return r_last(g_cons[z]('false'))
    else
      return g_cons[z]('true')
  };
  return r_last( arguments[0] )
};

// added 2015/08/29
dict['input'] = function () {
  // {input {@ type="a_type" value="val" onevent="°° JS exprs °°"}}
  var args = arguments[0]; 
  if (args.match( 'http://' )) // try to prevent cross_scripting
    return 'Sorry, external sources are not authorized in inputs!';
  if (args.match( /type\s*=\s*("|')\s*file\s*("|')/ ))
    return 'Sorry, type="file" is not allowed';
  var attr = args.match( /@@[\s\S]*?@@/ ); // any whitespace or not -> all
  if (attr == null) return 'ooops';
  attr = attr[0].replace(/^@@/, '').replace(/@@$/, ''); // clean attributes
  return '<input ' + attr + ' />';
};

// added 2016/02/15
dict['script'] = function (){ // {script °° code °°} 
  var args = arguments[0];
  if (args.match( 'http://' )) // try to prevent cross_scripting
    return 'Sorry, external sources are not authorized in scripts!';
  var script = unquote(args); 
  var code = (function () {
    var js = document.createElement('script');
    js.innerHTML = script;
    document.head.appendChild( js );
    document.head.removeChild( js );
  })();
  return '';
};
// added 2016/02/15
dict['style'] = function (){ // {style °° code °°} 
  var args = arguments[0];
  if (args.match( 'http://' )) // try to prevent cross_scripting
    return 'Sorry, external sources are not authorized in styles!';
  var style = unquote(args); 
  var code = (function () {
    var cs = document.createElement('style');
    cs.innerHTML = style;
    document.head.appendChild( cs );
    // document.head.removeChild( cs ); don't do that !
  })();
  return '';
};

// added 2015/09/12
dict['nanolisp'] = function () { // {nanolisp lambdalisp expression}
  var result = NANOLISP.parser( arguments[0] );
  return "Result (" + result.infos[0] + "|" + result.infos[1] + ") "
                    + result.infos[2] + "ms:\n" + result.val;
  
};

// added 2015/12/05
dict['minibox'] = function() {
  return MINIBOX.build( supertrim(arguments[0]) )
};

// added 2016/02/14
dict['turtle'] = function() { // {turtle x0 y0 a0 M100 T90 ...}
  var args = supertrim(arguments[0]).split(' ');
  var poly = [];
  poly.push( [parseFloat(args[0]),
              parseFloat(args[1]),
              parseFloat(args[2])] );
  for (var i=3; i < args.length; i++) {
    var act = args[i].charAt(0),
        val = parseFloat(args[i].substring(1));
    if (act === 'M') {
      var p = poly[poly.length-1],
          a = p[2] * Math.PI / 180.0,
          x = p[0] + val * Math.sin(a),
          y = p[1] + val * Math.cos(a);
      poly.push( [x,y,p[2]] )
    } else {
      var p = poly.pop();
      poly.push( [p[0],p[1],p[2]+val] ) 
    }
  }
  for (var pol = '', i=0; i < poly.length; i++)
    pol += Math.round(poly[i][0]) + ' '
        +  Math.round(poly[i][1]) + ' ';
  return pol
};

// ... and so on!

// public functions
 return { 
  evaluate: evaluate, 
  eval_simple_forms:eval_simple_forms 
 }

})(); // end of MICROTALK

var MINIBOX = (function() {

  var url=[], txt=[];

  var build = function(a) {
    var args = a.match( /@@[\s\S]*?@@/ );
    var body = a.replace( args[0], '' );
    args = args[0].replace( /@@/g, '' );
    var h = args.match( /height="([\d]+)"/ );
    var w = args.match( /width="([\d]+)"/ );
    var t = args.match( /thumb="([\d]+)"/ );
    h = (h !== null)? h[1] : 400; 
    w = (w !== null)? w[1] : 600;
    t = (t !== null)? t[1] : 30;
    var thumbs = ''; 
    var rex = /\(([^\s()]*)(?:[\s]*)([^()]*)\)/g;
    var picts = body.match(rex);
    for (var i=0; i< picts.length; i++) {
      var p = picts[i], index = p.indexOf( ' ' );
      url[i] = p.substring(1, index);
      txt[i] = p.substring(index, p.length-1);
      thumbs += '{img {@ height="'+t+'" src="' + url[i] 
             + '" title="' + txt[i] 
             + '" onmouseover="MINIBOX.flyover('+i+')"'
             + '  onclick="MINIBOX.doclick(true)"}}'; 
    }
    var pict = '{img {@ id="pict" height="'+h+'" src="'+url[0]+'" title="Click me to close."}}';
    var caption = '{div {@ id="text"}' + txt[0] + '}';
    var display = '{div {@ id="display_frame" style="display: none; position: relative; top: 0px; left: 50%; text-align: center; padding: 25px; background : #222; color: white; box-shadow: 0 0 500px black; border: 1px solid white; width: ' + w + 'px; margin-left: ' + (-w/2) + 'px;" onclick="MINIBOX.doclick(false)"}' + pict + caption + '}';
    return thumbs + display
  };

  var doclick = function(flag) {
    document.getElementById('display_frame').style.display = 
   (flag)?  'block' : 'none';
  };

  var flyover = function(i) {
    document.getElementById('pict').src = url[i];
    document.getElementById('text').innerHTML = txt[i];
  };

  return { build:build, doclick:doclick, flyover:flyover }
})(); // end of MINIBOX

/////////////////////////////////////////////////////////////////////////////
// HTML INTERFACE
// 3 containers are supposed to exist in the HTML file:
//   <textarea id="input" onkeyup="update()"></textarea>
//   <div id="infos"></div>
//   <div id="output"></div>

var update = function() {
  var input = document.getElementById('input').value;
  var output = MICROTALK.evaluate(input); 
  document.getElementById('infos').innerHTML = 
  '{' + output.bal.left + '|' 
      + output.bal.right + '} | ' 
      + output.time + ' ms';
  if (output.bal.left === output.bal.right)
    document.getElementById('output').innerHTML = output.val;
};

setTimeout( update, 10 );  // refresh on page loading  

/////////////////////////////////////////////////////////////////////////////

/*
 ward.asia.wiki adaptation by Ward Cunningham | created on 2015/08/09
 http://ward.asia.wiki.org/view/testing-microtalk

 To expose microtalk as a plugin in Ward Cunningham's wiki:

 STEP 1. replace the first line of MICROTALK function:
__________________________________________________________________________________

var MICROTALK = (function() {
__________________________________________________________________________________

 by the following code:
__________________________________________________________________________________

(function () {
__________________________________________________________________________________

 STEP 2. replace these two last lines of MICROTALK function: 
__________________________________________________________________________________

return {evaluate: evaluate}  // single public function
})();
__________________________________________________________________________________

 by the following code:
__________________________________________________________________________________

  function escape (text) {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  }

  function output (item) {
    var output = evaluate(item.text);
    var summary = '{' + output.bal.left + '|' 
                      + output.bal.right + '} | ' 
                      + output.time + ' ms';
    if (output.bal.left === output.bal.right)
      return output.val
    else
      return 'does not compute ' + summary
  }

  function emit ($item, item) {
    $item.append(
      '<table style="width:100%; background:#eee; padding:.8em; margin-bottom:5px;">' +
      '<tr><td style="white-space: pre-wrap;">' + escape(item.text) +
      '<tr><td style="background-color:#ddd;padding:15px;">' + output(item)
    )
  }

  function bind ($item, item) {
    $item.dblclick(function() {
      return wiki.textEditor($item, item);
    })
  }

  window.plugins.microtalk = {
    emit: emit,
    bind: bind
  }

}).call(this)
__________________________________________________________________________________

 STEP 3. Forget the HTML interface update() function 
         and the setTimeout( update, 10 );
*/
/////////////////////////////////////////////////////////////////////////////
