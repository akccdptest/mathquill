/**
 * Back-end code: Core abstract classes and architecture.
 */

var $ = jQuery, noop = function(){ return this; }, todo = function(){ alert('BLAM!\n\nAHHHHHH!\n\n"Oh god, oh god, I\'ve never seen so much blood!"\n\nYeah, that doesn\'t fully work yet.'); };

/**
 * MathElement is the core Math DOM tree node prototype.
 * Both MathBlock's and MathCommand's descend from it.
 */
function MathElement(){}
MathElement.prototype = { 
  prev: null,
  next: null,
  parent: null,
  firstChild: null,
  lastChild: null,
  eachChild: function(fn)
  {
    for(var child = this.firstChild; child !== null; child = child.next)
      if(fn.call(child) === false)
        break;
    return this;
  },
  reduceChildren: function(fn, initVal)
  {
    this.eachChild(function(){
      initVal = fn.call(this, initVal);
    });
    return initVal;
  },
};

/**
 * Commands and operators, like subscripts, exponents, or fractions.
 * May contain descendant commands, organized into blocks.
 */
function MathCommand(cmd, html_template)
{ 
  if(!arguments.length)
    return;

  this.cmd = cmd;
  this.html_template = html_template;
  this.jQinit();
  this.initBlocks();
}
MathCommand.prototype = $.extend(new MathElement, {
  jQinit: function()
  {
    return this.jQ = $(this.html_template).data('[[latexlive internal data]]', {cmd: this});
  },
  initBlocks: function()
  {
    var newBlock, prev = null, children = this.jQ.children(), num_blocks = children.length;
    for(var i = 0; i < num_blocks; i += 1)
    {
      newBlock = new MathBlock;
      newBlock.parent = this;
      newBlock.prev = prev;
      if(prev)
        prev.next = newBlock;
      else
        this.firstChild = newBlock;
      prev = newBlock;

      newBlock.jQ = children.eq(i).data('[[latexlive internal data]]', {block: newBlock});
      newBlock.setEmpty();
    }
    this.lastChild = newBlock;
  },
  latex: function()
  {
    return this.cmd + this.reduceChildren(function(initVal){
      return initVal + '{' + this.latex() + '}';
    }, '');
  },
  remove: function()
  {
    if(this.prev)
      this.prev.next = this.next;
    else
      this.parent.firstChild = this.next;
    
    if(this.next)
      this.next.prev = this.prev;
    else
      this.parent.lastChild = this.prev;
    
    this.jQ.remove();
    
    return this;
  },
  //placeholder for context-sensitive spacing.
  respace: noop,
  placeCursor: function(cursor)
  {
    cursor.prependTo(this.firstChild);
    return this;
  },
  isEmpty: function()
  {
    return this.reduceChildren(function(initVal){
      return initVal && this.isEmpty();
    }, true);
  },
});

/**
 * Lightweight command without blocks or children.
 */
function Symbol(cmd, html)
{
  MathCommand.call(this, cmd, html);
}
Symbol.prototype = $.extend(new MathCommand, {
  initBlocks: noop,
  latex: function()
  {
    return this.cmd;
  },
  placeCursor: noop,
  isEmpty: function(){ return true; },
});

/**
 * Children and parent of MathCommand's. Basically partitions all the
 * symbols and operators that descend (in the Math DOM tree) from
 * ancestor operators.
 */
function MathBlock(){}
MathBlock.prototype = $.extend(new MathElement, {
  latex: function()
  {
    return this.reduceChildren(function(initVal){
      return initVal + this.latex();
    }, '');
  },
  isEmpty: function()
  {
    return this.firstChild === null && this.lastChild === null;
  },
  setEmpty: function()
  {
    if(this.isEmpty())
    {
      this.jQ.addClass('empty');
      if(this.parent)
        this.jQ.html('[ ]');
    }
    return this;
  },
  removeEmpty:function()
  {
    if(this.jQ.hasClass('empty'))
      this.jQ.html('').removeClass('empty');
    return this;
  },
});

/**
 * An entity outside the Math DOM tree with one-way pointers (so it's only
 * a "view" of part of the tree, not an actual node/entity in the tree)
 * that delimit a list of symbols and operators.
 */
function MathFragment(parent, prev, next)
{
  if(!arguments.length)
    return;

  this.parent = parent;
  this.prev = prev || null; //so you can do 'new MathFragment(block)' without
  this.next = next || null; //ending up with this.prev or this.next === undefined

  this.jQinit(this.reduce(function(initVal){ return initVal.add(this.jQ); }, $()));
}
MathFragment.prototype = {
  remove: MathCommand.prototype.remove,
  jQinit: function(children)
  {
    return this.jQ = children;
  },
  each: function(fn)
  {
    for(var el = (this.prev ? this.prev.next : this.parent.firstChild); el !== this.next; el = el.next)
      if(fn.call(el) === false)
        break;
    return this;
  },
  reduce: function(fn, initVal)
  {
    this.each(function()
    {
      initVal = fn.call(this, initVal);
    });
    return initVal;
  },
  blockify: function()
  {
    var newBlock = new MathBlock;
    if(this.prev)
      newBlock.firstChild = this.prev.next, this.prev.next = this.next;
    else
      newBlock.firstChild = this.parent.firstChild, this.parent.firstChild = this.next;

    if(this.next)
      newBlock.lastChild = this.next.prev, this.next.prev = this.prev;
    else
      newBlock.lastChild = this.parent.lastChild, this.parent.lastChild = this.prev;

    newBlock.firstChild.prev = this.prev = null;
    newBlock.lastChild.next = this.next = null;

    this.parent = newBlock;
    this.each(function(){ this.parent = newBlock; });

    newBlock.jQ = this.jQ;
    
    return newBlock;
  },
};
