/**
*	awc_image_rotater
*
*	Rotate images, utilising Javascript and the canvas HTML element (so, won't work in IE)
*	Requires Prototype v1.6
*
*	@package	awc_image_rotater
*	@author		Kevin Porter	<awc_image_rotater@tinternet.info>
*	@copyright	Copyright (c) 2009 Kevin Porter & Advanced Web Construction Ltd (http://webutils.co.uk, http://coding.tinternet.info)
*	@license	MIT (see LICENSE file included in distribution)
*	@link		http://webutils.co.uk/awc-image-rotater	Project home page
*
*	$Id: awc_image_rotater.js 81 2009-12-31 12:21:44Z kev $
*/
 
 
// {{{ START awc_image_rotater class definition
/**
*	awc_image_rotater class
*
*	Private methods/properties begin with '_'
*/
var awc_image_rotater = Class.create(
{
	id: null,
 
	img: null,
 
	_hConfig: null,
 
	_canvas: null,
	_context: null,
 
	_canvas_width: null,
	_canvas_height: null,
 
	_canvas_rotation: 0,
 
	_image_width: null,
	_image_height: null,
 
	_img_copy: null,
	_img_data_url: null,
	_orig_src: null,
 
	_hStyles: {},
 
	_overflow_x: 0,
	_overflow_y: 0,
 
	_log_textarea: null,
 
	_animating: false,
	_stop_animating: false,
	_animateConfig: null,
 
	_mouseover: false,
	_prev_imageX: null,
	_prev_imageY: null,
 
	_empty_image_data: null,
 
	_enabled: true,
 
	/**
	*	Constructor
	*
	*	@param	hConfig.img		object		image reference
	*	@param	hConfig.id		string		unique id for this object. If not supplied, one is autogenerated
	*										using 'awc_image_rotater__' followed by the image id
	*	@param	hCOnfig.replace_image	boolean		Whether to initially replace the image with the canvas
	*	@param	hConfig.zIndex	int			z-index to apply to image: affects image overlaps and event firing
	*
	*/
	initialize: function( config )
	{
		if ( !awc_image_rotater.supported )
			return false;
 
		if ( $('awc_image_rotater__log') )
			this._log_textarea = $('awc_image_rotater__log');
		if ( this._log_textarea )
			$('awc_image_rotater__log').setValue('');
 
		// Config defaults/validation
		var defaults = $H({	img: null,
							id: null,
							replace_image: true });
		this._hConfig = defaults.merge(config);
 
		this.img = $(this._hConfig.get('img'));
		if ( ! this.img )
			return false;
 
		// Set id (create one if none supplied)
		this.id = this._hConfig.get('id') || 'awc_image_rotater__' + this.img.identify();
 
		this._canvas = new Element('canvas');
 
		// Assign image src to tmp image, just so we can be sure it's laoded before continuing
		var tmpimg = new Image();
		tmpimg.observe( 'load', this._initialize_step2.bind(this) );
		tmpimg.src = this.img.src;
	},
 
	_initialize_step2: function()
	{
		this._image_width = parseInt(this.img.getStyle('width'));
		this._image_height = parseInt(this.img.getStyle('height'));
 
		if ( !this._duplicate_image() )
		{
			return false;
		}
 
		this._create_empty_image_data();
 
		// Set some style properties which we'll need to adjust measurements
		[ 'Top', 'Right', 'Bottom', 'Left' ].each(
			function(edge)
			{
				this._hStyles['border'+edge+'Width'] = this.img.getStyle('border'+edge+'Width');
				this._hStyles['border'+edge+'Color'] = this.img.getStyle('border'+edge+'Color');
				this._hStyles['border'+edge+'Style'] = this.img.getStyle('border'+edge+'Style');
 
				this._hStyles['padding'+edge] = this.img.getStyle('padding'+edge);
				this._hStyles['margin'+edge] = this.img.getStyle('margin'+edge);
			}.bind(this));
 
 
		// Calculate width needed to accomodate roatating image
		this._canvas_width = this._canvas_height = Math.sqrt( Math.pow(this._image_width,2) + Math.pow(this._image_height,2) );
		this._canvas.writeAttribute( { width: this._canvas_width, height: this._canvas_height } );
 
		this._overflow_x = parseInt( (this._canvas_width - this._image_width)/2 + 0.5 );
		this._overflow_y = parseInt( (this._canvas_height - this._image_height)/2 + 0.5 );
		this._hide_canvas();
		document.body.insert(this._canvas);
 
		var hCanvasPos = this._canvas_position();
		this._set_canvas_position( hCanvasPos.left, hCanvasPos.top );
 
		if ( this._hConfig.get('zIndex') )
			this.set_zIndex(this._hConfig.get('zIndex'));
 
		this._context = this._canvas.getContext('2d');
		this._context.drawImage( this.img, this._overflow_x, this._overflow_y, this._image_width, this._image_height );
 
		this._orig_src = this.img.src;
 
		if ( this._hConfig.get('replace_image') )
		{
			this._hide_image();
			this._show_canvas();
		}
 
		// HACK - repositioning at this point seems to fix positioning probems in some browsers.
		// Needs to be looked at and fixed properly really.
		var hCanvasPos = this._canvas_position();
		this._set_canvas_position( hCanvasPos.left, hCanvasPos.top );
 
		Event.observe( window, 'resize',
			function(ev)
			{
				var hCanvasPos = this._canvas_position();
				this._set_canvas_position( hCanvasPos.left, hCanvasPos.top );
			}.bindAsEventListener(this) );
 
		this._canvas.observe( 'mouseover', awc_image_rotater._handle_mouseover.bindAsEventListener(this) );
 
		this._canvas.observe( 'click', awc_image_rotater._handle_other_mouse_events.bindAsEventListener(this) );
		this._canvas.observe( 'mousedown', awc_image_rotater._handle_other_mouse_events.bindAsEventListener(this) );
		this._canvas.observe( 'mouseup', awc_image_rotater._handle_other_mouse_events.bindAsEventListener(this) );
		this._canvas.observe( 'dblclick', awc_image_rotater._handle_other_mouse_events.bindAsEventListener(this) );
 
		this.observe( 'awc_image_rotater:image_mouseover', this._image_mouseover.bindAsEventListener(this) );
		this.observe( 'awc_image_rotater:image_mouseout', this._image_mouseout.bindAsEventListener(this) );
		this.observe( 'awc_image_rotater:image_mousemove', this._image_mousemove.bindAsEventListener(this) );
		this.observe( 'awc_image_rotater:image_mousechange', this._image_mousechange.bindAsEventListener(this) );
		this.observe( 'awc_image_rotater:image_click', this._image_click.bindAsEventListener(this) );
		this.observe( 'awc_image_rotater:image_mousedown', this._image_mousedown.bindAsEventListener(this) );
		this.observe( 'awc_image_rotater:image_mouseup', this._image_mouseup.bindAsEventListener(this) );
		this.observe( 'awc_image_rotater:image_dblclick', this._image_dblclick.bindAsEventListener(this) );
 
		// Add to the global list
		awc_image_rotater.rotaters[this.img.identify()] = this;
		awc_image_rotater.rotaters[this.id] = this;
 
		// HACK - adding this pause fixes a bug whereby the canvas was appearing blank if rotate() or
		// animate() were being called from an initiailisation event handler rather than from a mouse
		// event handler
		setTimeout( this._initialize_step3.bind(this), awc_image_rotater._initiliased_delay );
	},
 
	_initialize_step3: function()
	{
		this.fire('awc_image_rotater:initialised');
	},
 
	set_zIndex: function(z)
	{
		this._canvas.setStyle( { zIndex: z } );
	},
 
	get_zIndex: function()
	{
		return parseInt(this._canvas.getStyle('zIndex'));
	},
 
	get_canvas_dimensions: function()
	{
		var iWidth = parseInt(this._canvas_width+0.5);
		var iHeight = parseInt(this._canvas_height+0.5);
		return { width: this._canvas_width, height: this._canvas_height,
				iWidth: iWidth, iHeight: iHeight };
	},
 
	_canvas_position: function()
	{
		var aOffset = this.img.cumulativeOffset();
		var x = aOffset[0];
		var y = aOffset[1];
 
		var canvas_left = x - this._overflow_x + parseInt(this._hStyles.paddingLeft) +
					parseInt(this._hStyles.borderLeftWidth);
		var canvas_top = y - this._overflow_y + parseInt(this._hStyles.paddingTop) +
					parseInt(this._hStyles.borderTopWidth);
 
		return { left: canvas_left, top: canvas_top };
	},
 
	_set_canvas_position: function( x, y )
	{
		this._canvas.setStyle( { position: 'absolute', left: x+'px', top: y+'px' } );
	},
 
	_log: function(msg)
	{
		if ( this._log_textarea )
			this._log_textarea.setValue( this.id + ': ' + msg + '\n' + this._log_textarea.getValue() );
	},
 
	_image_mouseout: function(ev)
	{
//		this._log('event: image_mouseout (' + ev.memo.imageX + ',' + ev.memo.imageY + ')' );
		this._log('event: image_mouseout (ev.memo: ' + $H(ev.memo).inspect() + ')' );
	},
 
	_image_mouseover: function(ev)
	{
//		this._log('event: image_mouseover (' + ev.memo.imageX + ',' + ev.memo.imageY + ')' );
		this._log('event: image_mouseover (ev.memo: ' + $H(ev.memo).inspect() + ')' );
	},
 
	_image_mousemove: function(ev)
	{
//		this._log('event: image_mousemove (' + ev.memo.imageX + ',' + ev.memo.imageY + ')' );
		this._log('event: image_mousemove (ev.memo: ' + $H(ev.memo).inspect() + ')' );
	},
 
	_image_mousechange: function(ev)
	{
//		this._log('event: image_mousechange (' + ev.memo.imageX + ',' + ev.memo.imageY + ')' );
		this._log('event: image_mousechange (ev.memo: ' + $H(ev.memo).inspect() + ')' );
	},
 
	_image_click: function(ev)
	{
//		this._log('event: image_click (' + ev.memo.imageX + ',' + ev.memo.imageY + ')' );
		this._log('event: image_click (ev.memo: ' + $H(ev.memo).inspect() + ')' );
	},
 
	_image_mousedown: function(ev)
	{
//		this._log('event: image_mousedown (' + ev.memo.imageX + ',' + ev.memo.imageY + ')' );
		this._log('event: image_mousedown (ev.memo: ' + $H(ev.memo).inspect() + ')' );
	},
 
	_image_mouseup: function(ev)
	{
//		this._log('event: image_mouseup (' + ev.memo.imageX + ',' + ev.memo.imageY + ')' );
		this._log('event: image_mouseup (ev.memo: ' + $H(ev.memo).inspect() + ')' );
	},
 
	_image_dblclick: function(ev)
	{
//		this._log('event: image_dblclick (' + ev.memo.imageX + ',' + ev.memo.imageY + ')' );
		this._log('event: image_dblclick (ev.memo: ' + $H(ev.memo).inspect() + ')' );
	},
 
	mouse_within_image: function( x, y, ret )
	{
		// Chacks whether a mouse click was over the image portion of the canvas. To do this, we must
		// rotate the point in the opposite direction to the canvas's rotation, by the same angle, and
		// check whether the rotated point lies in the confines of the originally unrotated image.
//this._log('mouse_within_image(): x = ' + x + ', y = ' + y );
 
		// Get point relative to top left of canvas
		var hCanvasPos = this._canvas_position();
		var Cx = x - hCanvasPos.left;
		var Cy = y - hCanvasPos.top;
//this._log('mouse_within_image(): Cx = ' + Cx + ', Cy = ' + Cy );
 
		// Rotate the point
		var hCanvasPos = this._canvas_position();
		var aCentrePos = this._canvas_centre();
		var aRC = this._rotate_point( -this._canvas_rotation, [Cx,Cy] );
//this._log('mouse_within_image(): aRC = ' + aRC);
 
		// Check rotated point against original image
		var image_top_left_x = this._overflow_x;
		var image_top_left_y = this._overflow_y;
		var image_bottom_right_x = parseInt(this._canvas_width - this._overflow_x + 0.5);
		var image_bottom_right_y = parseInt(this._canvas_height - this._overflow_y + 0.5);
		var bWithinImage = ( aRC[0] >= image_top_left_x && aRC[0] <= image_bottom_right_x &&
							aRC[1] >= image_top_left_y && aRC[1] <= image_bottom_right_y );
 
//		if ( ret && bWithinImage )
		if ( ret )
		{
			ret.imageX = parseInt(aRC[0] - this._overflow_x + 0.5);
			ret.imageY = parseInt(aRC[1] - this._overflow_y + 0.5);
		}
 
		return bWithinImage;
	},
 
	mouse_within_canvas: function( x, y, ret )
	{
		var hCanvasPos = this._canvas_position();
		var Cx = hCanvasPos.left, Cy = hCanvasPos.top;
 
		var bWithinCanvas = (x >= Cx && x <= (Cx+this._canvas_width) &&
							y >= Cy && y <= (Cy+this._canvas_height));
 
		if ( ret )
		{
			ret.x = x - Cx;
			ret.y = y - Cy;
		}
 
		return bWithinCanvas;
	},
 
	_rotate_point: function( deg, aPoint )
	{
		var Tx = parseInt( (this._image_width/2) + this._overflow_x + 0.5 );
		var Ty = parseInt( (this._image_height/2) + this._overflow_y + 0.5 );
 
		var aTrans = this._translate_point( aPoint, [-Tx, -Ty] );
 
		var rad = this.deg2rad(deg);
		var Rx = Math.cos(rad) * aTrans[0] - Math.sin(rad) * aTrans[1];
		var Ry = Math.sin(rad) * aTrans[0] + Math.cos(rad) * aTrans[1];
 
		var aRet = this._translate_point( [Rx, Ry], [Tx, Ty] );
 
		return aRet;
	},
 
	_translate_point: function( aPoint, aTranslation )
	{
		var aRet = [ aPoint[0] + aTranslation[0], aPoint[1] + aTranslation[1] ];
 
		return aRet;
	},
 
	_canvas_centre: function()
	{
		var Cx = parseInt( (this._image_width/2) + this._overflow_x + 0.5 );
		var Cy = parseInt( (this._image_height/2) + this._overflow_y + 0.5 );
 
		return [Cx, Cy];
	},
 
	observe: function( event_name, func )
	{
		if ( !awc_image_rotater.supported )
			return false;
 
		this._canvas.observe( event_name, func );
	},
 
	stopObserving: function( event_name, func )
	{
		if ( !awc_image_rotater.supported )
			return false;
 
		this._canvas.stopObserving( event_name, func );
	},
 
	fire: function( event_name, memo )
	{
		if ( !awc_image_rotater.supported )
			return false;
 
		this._canvas.fire(event_name, memo);
	},
 
	_duplicate_image: function()
	{
		this._img_copy = new Image();
		var canvas = new Element('canvas');
		canvas.width = this._image_width;
		canvas.height = this._image_height;
		var context = canvas.getContext('2d');
		context.drawImage( this.img, this._overflow_x, this._overflow_y, this._image_width, this._image_height );
 
		try
		{
			this.img_data_url = canvas.toDataURL();
		}
		catch(err)
		{
			// This is probably a security exception caused by Same Origin Policy
			this._enabled = false;
		}
 
		if ( this._enabled )
		{
			this._img_copy.width = this._image_width;
			this._img_copy.height = this._image_height;
			this._img_copy.src = this.img_data_url;
		}
 
		return this._enabled;
	},
 
	_create_empty_image_data: function()
	{
		var canvas = new Element('canvas');
		canvas.width = this._image_width;
		canvas.height = this._image_height;
 
		var context = canvas.getContext('2d');
		this._empty_image_data = canvas.toDataURL();
	},
 
	rotate: function( deg )
	{
		if ( !awc_image_rotater.supported )
			return false;
 
		if ( !this._enabled )
			return false;
 
		this._context.clearRect( 0, 0, this._canvas.width, this._canvas.height );
 
		var Tx = parseInt( (this._image_width/2) + this._overflow_x + 0.5 );
		var Ty = parseInt( (this._image_height/2) + this._overflow_y + 0.5 );
 
		this._rotate_canvas( deg, [Tx, Ty] );
		this._context.drawImage( this._img_copy, this._overflow_x, this._overflow_y, this._image_width, this._image_height );
 
		// Redraw fix for Opera, from vasko's comment on this page: http://ajaxian.com/archives/forcing-a-ui-redraw-from-javascript
		this._canvas.style.display = 'none'; var redrawFix = this._canvas.offsetHeight; this._canvas.style.display = 'block';
 
		this._canvas_rotation = (this._canvas_rotation + deg) % 360;
	},
 
	_rotate_canvas: function( deg, aPoint )
	{
		this._context.translate( aPoint[0], aPoint[1] );
		this._context.rotate( this.deg2rad(deg) );
		this._context.translate( -aPoint[0], -aPoint[1] );
	},
 
	/**
	*	Parameters in hArgs: degrees, steps, interval, loop
	*/
	animate: function( hArgs )
	{
		if ( !awc_image_rotater.supported )
			return false;
 
		if ( !this._enabled )
			return false;
 
		if ( this._animating )
			return false;
 
		if ( hArgs.steps < 1 )
			return false;
 
		// NB Setting _stop_animating is a bit of a hack. Sometimes it will be left on even though
		// we're not currently animating (due to problems with mouse move/out event detection)
		this._stop_animating = false;
 
		this._animateConfig = hArgs;
 
		this._animating = true;
 
		this.steps = hArgs.steps;
		this.degrees_per_step = hArgs.degrees / hArgs.steps;
 
		if ( ! this._hConfig.get('replace_image') )
			this._show_canvas();
 
		this._hide_image();
		this._animation_step( this.degrees_per_step );
 
		new PeriodicalExecuter(
			this._animation_step.bind(this), hArgs.interval );
	},
 
	/** Fired from PeriodicalExecutor */
	_animation_step: function(pe)
	{
		this.rotate( this.degrees_per_step );
 
		// Have we finished the animation naturally? Or received a _stop_animating command?
		var bStop = false;
 
		if ( (--this.steps <= 0) )
		{
			bStop = this._stop_animating;
 
			if ( !bStop )
			{
				if ( ! this._animateConfig.loop )
					bStop = true;
				else
					this.steps = this._animateConfig.steps;
			}
		}
 
		if ( bStop )
		{
			if ( ! this._hConfig.get('replace_image') )
			{
				this._show_image();
				this._hide_canvas();
			}
			this._animating = false;
			this._stop_animating = false;
			pe.stop();
		}
	},
 
	stop_animating: function()
	{
		this._stop_animating = true;
	},
 
	_hide_image: function()
	{
		this.img.src = this._empty_image_data;
	},
 
	_show_image: function()
	{
		this.img.src = this._orig_src;
	},
 
	_hide_canvas: function()
	{
		this._canvas.setStyle( { visibility: 'hidden' } );
	},
 
	_show_canvas: function()
	{
		this._canvas.setStyle( { visibility: 'visible' } );
	},
 
	deg2rad: function(d)
	{
		return (d * (Math.PI/180));
	},
 
	is_animating: function()
	{
		return this._animating;
	},
 
	get_canvas_rotation: function()
	{
		return this._canvas_rotation;
	}
});
 
// }}} END awc_image_rotater class definition
 
// {{{ START Static properties/methods
 
// Whether the browser supports awc_image_rotater
awc_image_rotater.supported = false;
 
// Some properties for helping with mouse position tracking
awc_image_rotater._handling_mouseover = false;
awc_image_rotater._mouseX = 0;
awc_image_rotater._mouseY = 0;
awc_image_rotater._mouseX_prev = 0;
awc_image_rotater._mouseY_prev = 0;
awc_image_rotater._mouse_tracking_interval = 0.1; // seconds
awc_image_rotater._initiliased_delay = 100; // milliseconds
 
// A list of all the awc_image_rotater objects on the page
awc_image_rotater.rotaters = {};
 
awc_image_rotater.get = function(id)
{
 
};
 
awc_image_rotater.check_browser_support = function()
{
	var tmp = new Element('canvas');
	if ( window.HTMLCanvasElement )
		awc_image_rotater.supported = true;
};
 
 
// {{{ START Convenience functions for bulk instantiation/animation
/**
*	Convenience function for bulk instantiation of awc_image_rotater objects and setting of
*	event handlers (on the images themselves, not the awc_rotater objects)
*
*	@param	hOpts.which		string		CSS selector specifying images to work on
*	@param	hOpts.when		string		Name of event on which to start animation
*	@param	hOpts.animateConfig		object		Animation config parameters (see animate() method)
*
*/
awc_image_rotater.init_image_events = function(hOpts)
{
	if ( !awc_image_rotater.supported )
		return false;
 
	$$( hOpts.which ).each(
		function(im)
		{
			var image_id = im.identify();
			awc_image_rotater.rotaters[image_id] =
				new awc_image_rotater(
					{
						img: im
					,	replace_image: false
					} );
 
			im.observe( hOpts.when,
				function(ev)
				{
					awc_image_rotater.rotaters[image_id]._show_canvas();
					awc_image_rotater.rotaters[image_id].animate( hOpts.animateConfig );
				}.bindAsEventListener(this, hOpts));
		});
 
 
};
 
/**
*	Convenience function for bulk instantiation of awc_image_rotater objects and setting of
*	event handlers (on the awc_image_rotater objects)
*
*	@param	hOpts.which		string		CSS selector specifying images to work on
*	@param	hOpts.when		string		Name of event on which to start animation
*	@param	hOpts.animateConfig		object		Animation config parameters (see animate() method)
*
*/
awc_image_rotater.init_events = function(hOpts)
{
	if ( !awc_image_rotater.supported )
		return false;
 
	$$( hOpts.which ).each(
		function(im)
		{
			var rot = new awc_image_rotater(
						{
							img: im
						} );
 
			var image_id = im.identify();
 
			awc_image_rotater.rotaters[rot.id].observe( hOpts.when,
				function(ev)
				{
					awc_image_rotater.rotaters[rot.id].animate( hOpts.animateConfig );
				}.bindAsEventListener(this, hOpts));
		});
 
 
};
// }}} END Convenience functions for bulk instantiation/animation
 
/* {{{ START Handle mouse events */
//	Deal with mouse events outside of object scope, and fire the required events
//	on objects from here
 
// {{{ START awc_image_rotater._handle_mouseover()
/**
*	Handles mouseover event of all awc_image_rotater canvas objects
*
*	Fires awc_image_rotater:image_mouseover/out/move events if required. Launches a PeriodicalExecuter to check
*	mouse coords - better than just using mousemove event as the image rotations may bring the images under the
*	mouse pointer.
*
*	@param	ev	Event object
*/
awc_image_rotater._handle_mouseover = function(ev)
{
	// Return if we're already tracking mouse
	if ( awc_image_rotater._handling_mouseover )
		return false;
 
	var x = ev.pointerX(), y = ev.pointerY();
 
	// Find out which image, if any, the mouse is currently over
	var bOverCanvas = awc_image_rotater.within_canvas(x,y);
 
	if ( !bOverCanvas )
	{
		// NB - this should never be executed
		awc_image_rotater._handling_mouseover = false;
	}
	else
	{
		awc_image_rotater._handling_mouseover = true;
 
		var res = awc_image_rotater.check_mouse_event_coords( x, y );
		if ( res.rotater )
		{
			// Fire mouseover event for the relevant rotater. May need to fire mouseout for
			// one of the others
			var canvasXY = {};
			var bWithinCanvas = this.mouse_within_canvas( x, y, canvasXY );
			var memo = { id: res.rotater.id, imageX: res.imageXY.imageX, imageY: res.imageXY.imageY,
						canvasX: canvasXY.x, canvasY: canvasXY.y, mouseX: x, mouseY: y };
			res.rotater.fire( 'awc_image_rotater:image_mouseover', memo );
			res.rotater._mouseover = true;
 
			for ( var k in awc_image_rotater.rotaters )
			{
				var rot = awc_image_rotater.rotaters[k];
				if ( rot._mouseover )
				{
					// In the case of image_mouseout we don't have imageX/imageY values.
					// Get them now.
					var imageXY = {};
					var bWithin = rot.mouse_within_image(x,y,imageXY);
					memo.imageX = imageXY.imageX;
					memo.imageY = imageXY.imageY;
					res.rotater.fire( 'awc_image_rotater:image_mouseout', memo );
					rot._mouseover = false;
				}
			}
		}
 
		document.observe( 'mousemove', awc_image_rotater._update_mouse_coords );
		awc_image_rotater._mouseX_prev = awc_image_rotater._mouseX;
		awc_image_rotater._mouseY_prev = awc_image_rotater._mouseY;
 
		var pe = new PeriodicalExecuter(
			function(pe)
			{
				var x = awc_image_rotater._mouseX, y = awc_image_rotater._mouseY;
				var bMouseMoved = (awc_image_rotater._mouseX != awc_image_rotater._mouseX_prev ||
									awc_image_rotater._mouseY != awc_image_rotater._mouseY_prev);
				awc_image_rotater._mouseX_prev = awc_image_rotater._mouseX;
				awc_image_rotater._mouseY_prev = awc_image_rotater._mouseY;
 
				var bOverCanvas = awc_image_rotater.within_canvas(x,y);
 
				// Find out which image, if any, the mouse is currently over
				var res = awc_image_rotater.check_mouse_event_coords( x, y );
 
				// Loop through all rotaters, fire mouseover or mouseout events as necessary
				for ( var k in awc_image_rotater.rotaters )
				{
					var rot = awc_image_rotater.rotaters[k];
 
					var canvasXY = {};
					var bWithinCanvas = rot.mouse_within_canvas( x, y, canvasXY );
 
					var memo = { id: rot.id, imageX: res.imageXY.imageX, imageY: res.imageXY.imageY,
								canvasX: canvasXY.x, canvasY: canvasXY.y, mouseX: x, mouseY: y };
 
					// Fire mousemove event?
					if ( rot._mouseover && (res.rotater && (res.rotater.id === rot.id)) )
					{
						if ( bMouseMoved )
							rot.fire( 'awc_image_rotater:image_mousemove', memo );
					}
 
					if ( !rot._mouseover )
					{
						// Fire mouseover event?
						if ( res.rotater && (res.rotater.id === rot.id) )
						{
							rot._mouseover = true;
							rot.fire( 'awc_image_rotater:image_mouseover', memo );
						}
					}
					else
					{
						// Fire mouseout event?
						if ( ! (res.rotater && (res.rotater.id === rot.id)) )
						{
							rot._mouseover = false;
 
							// In the case of image_mouseout we don't have imageX/imageY values.
							// Get them now.
							var imageXY = {};
							var bWithin = rot.mouse_within_image(x,y,imageXY);
//awc_image_rotater.log( 'imageXY: ' + $H(imageXY).inspect() );
							memo = { id: rot.id, imageX: imageXY.imageX, imageY: imageXY.imageY };
							rot.fire( 'awc_image_rotater:image_mouseout', memo );
						}
						else
						{
							var bChanged = (memo.imageX !== rot._prev_imageX ||
											memo.imageY !== rot._prev_imageY);
							rot._prev_imageX = memo.imageX;
							rot._prev_imageY = memo.imageY;
 
							// Fire a mousechange event if the pointer has moved relative to the image
							// (which may mean the pointer hasn't moved bu the image has)
							if ( bChanged )
								rot.fire( 'awc_image_rotater:image_mousechange', memo );
						}
					}
 
				}
 
				if ( !bOverCanvas )
				{
					pe.stop();
					document.stopObserving( 'mousemove', awc_image_rotater._update_mouse_coords );
					awc_image_rotater._handling_mouseover = false;
				}
			}, awc_image_rotater._mouse_tracking_interval );
	}
};
// }}} END awc_image_rotater._handle_mouseover()
 
 
// {{{ START awc_image_rotater._handle_other_mouse_events()
/**
*	Handles mouseup/down/click/dbclick events
*
*	Fires the appropirate event if it happened with mouse pointer over the image.
*
*	@param	ev	Event object
*/
awc_image_rotater._handle_other_mouse_events = function(ev)
{
	var mouseX = ev.pointerX(), mouseY = ev.pointerY();
 
	var res = awc_image_rotater.check_mouse_event_coords( mouseX, mouseY );
	if ( res.rotater )
	{
		// Get canvas coords
		var canvasXY = {};
		var bWithinCanvas = res.rotater.mouse_within_canvas( mouseX, mouseY, canvasXY );
 
		var memo = { id: res.rotater.id, imageX: res.imageXY.imageX, imageY: res.imageXY.imageY,
					canvasX: canvasXY.x, canvasY: canvasXY.y, mouseX: mouseX, mouseY: mouseY };
		res.rotater.fire('awc_image_rotater:image_' + ev.type, memo );
	}
};
// }}} END awc_image_rotater._handle_other_mouse_events()
 
 
/**
*	Checks if mouse pointer is over an image
*
*	If pointer is actually over more than one image at the
*	same time, z-index is taken into account to decide which single image it is currently over
*	Returns an object containing the properties:
*		-	rotater:	the awc_image_rotater containing the image the pointer is over
*		-	imageXY:	an object with x/y properties containing coords of mouse pointer (relative
*						to top left of image)
*
*	@param	x		int
*	@param	y		int
*
*	@return	object
*/
awc_image_rotater.check_mouse_event_coords = function(x,y)
{
	var target_rot = null;
	var imageXY = {};
 
	for ( var k in awc_image_rotater.rotaters )
	{
		var rot = awc_image_rotater.rotaters[k];
		var bVisible = (rot._canvas.getStyle( 'visibility' ) === 'visible');
 
		var image_coords = {};
		if ( bVisible && rot.mouse_within_image(x,y,image_coords) )
		{
			var z = rot.get_zIndex();
			if ( target_rot === null ||
				(z > target_rot.get_zIndex()) )
			{
				target_rot = rot;
				imageXY = image_coords;
			}
		}
	}
 
	return { rotater: target_rot, imageXY: imageXY };
};
 
 
/**
*	Checks whether coords lie inside any awc_image_rotater canvas
*
*	@param	x	int
*	@param	y	int
*
*	@return	boolean
*/
awc_image_rotater.within_canvas = function(x,y)
{
	var bWithinCanvas = false;
 
	for ( var k in awc_image_rotater.rotaters )
	{
		var rot = awc_image_rotater.rotaters[k];
		var bVisible = (rot._canvas.getStyle( 'visibility' ) === 'visible');
		bWithinCanvas |= (bVisible && rot.mouse_within_canvas( x, y ));
 
		if ( bWithinCanvas )
			break;
	}
 
	return bWithinCanvas;
};
 
 
awc_image_rotater._update_mouse_coords = function(ev)
{
	var x = ev.pointerX(), y = ev.pointerY();
 
	awc_image_rotater._mouseX = x;
	awc_image_rotater._mouseY = y;
};
 
/* }}} END Handle mouse events */
 
 
awc_image_rotater.log = function(msg)
{
	var log = $('awc_image_rotater__log');
	if ( log )
		log.setValue( msg + '\n' + log.getValue() );
};
 
 
// }}} END Static properties/methods
 
awc_image_rotater.check_browser_support();
 