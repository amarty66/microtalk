# microtalk

The {lambda way} project is a light framework built on a wiki, {lambda tank}, coming with a true functional programming language, {lambda talk}, which is here: http://lambdaway.free.fr/lambdaspeech/.

{micro talk} is {lambda talk} where the engine is reduced to its minimum, two special forms, [lambda, def] and no built-in primitive.

1) out of braces words are just words,
2) functions are created using {lambda {args} expression}, 
3) expressions are named using {def name expression},

So syntax is straitghtforward but you must build everything by yourself ... 

As an example, defining these functions

    (def | (lambda (:a :b) :a))
    (def ø (lambda (:a :b) :b))
    (def □ (lambda (:a :b :c) (:c :a :b)))
    (def [ (lambda (:c) (:c |)))
    (def ] (lambda (:c) (:c ø)))
    (def ? (lambda (:c) (:c (| ]) [)))
    (def ¿ (lambda (:c) (:c (| [) ])))
    (def Y (lambda (:f :l) (:f :f :l)))

you can write a recursive function

    (def D
     (lambda (:l)
      (((? :l)
       (□ (lambda (:l))
          (lambda (:l) ([ :l) (D (] :l))) )) :l)))
      
define a list of fruits

    (def FRUITS
     (□ apple
      (□ banana
       (□ lemon
        (□ orange ø)))))
   
and display it   
   
    (D (FRUITS))
    -> apple banana lemon orange

So, with such a reduced set of rules you could create data structures, pairs & lists, a control structure, recursion, and then begin to play with lists, display them. You could also reverse them, count their elements (in a very old numeral system using pipes ...). You could also build true numbers and a set of related operators, [+,*,-,/,%], compute factorials, play with Hanoï Towers and much more, theoretically ad libitum. 

More can be seen in http://lambdaway.free.fr/lambdaspeech/?view=microtalk and more generally in http://lambdaway.free.fr/lambdaspeech/

Your opinion is welcome.
Alain Marty
