/*global Backbone, _*/
/**
 * Backbone-Nested 1.0.3 - An extension of Backbone.js that keeps track of nested attributes
 *
 * http://afeld.github.com/backbone-nested/
 *
 * Copyright (c) 2011-2012 Aidan Feldman
 * MIT Licensed (LICENSE)
 */

(function(Backbone, _, undefined) {
    'use strict';

    Backbone.NestedModel = Backbone.Model.extend({
        constructor: function(attrs, opts) {
            Backbone.Model.prototype.constructor.apply(this, arguments);
        },

        get: function(attrStrOrPath, opts) {
            var attrPath = Backbone.NestedModel.attrPath(attrStrOrPath),
                childAttr = attrPath[0],
                result = Backbone.Model.prototype.get.call(this, childAttr);

            opts = opts || {};

            // walk through the child attributes
            attrPath.shift();
            _.each(attrPath, function(childAttr) {
                result = result[childAttr];
                if (result === undefined) {
                    return false;
                }
            });

            return result;
        },

        has: function(attr) {
            // for some reason this is not how Backbone.Model is implemented - it accesses the attributes object directly
            var result = this.get(attr, {silent: true});
            return !(result === null || _.isUndefined(result));
        },

        set: function(attrs, opts) {
            var newAttrs = _.cloneDeep(this.attributes);

            opts = opts || {};

            _.each(attrs, function(value, key) {
                var attrPath = Backbone.NestedModel.attrPath(key),
                    attrObj = Backbone.NestedModel.createAttrObj(attrPath, value);

                this.mergeAttrs(newAttrs, attrObj, opts);
            });

            return Backbone.Model.prototype.set.call(this, newAttrs, opts);
        },

        unset: function(attrStr, opts) {
            var setOpts = {};

            setOpts[attrStr] = void 0;
            this.set(setOpts, opts);

            return this;
        },

        remove: function(attrStr, opts) {
            var attrPath, aryPath, childAry;

            this.unset(attrStr, opts);
            attrPath = Backbone.NestedModel.attrPath(attrStr);

            if (_.isNumber(_.last(attrPath))) {
                aryPath = _.initial(attrPath);
                childAry = this.get(aryPath, {silent: true});

                // compact the array (remove falsy values)
                childAry = _.compact(childAry);
            }

            return this;
        },

        toJSON: function(){
            return _.cloneDeep(this.attributes);
        },

        // private

        mergeAttrs: function(dest, source, opts, stack){
            stack = stack || [];

            _.each(source, function(sourceVal, prop){
                var destVal = dest[prop],
                    newStack = stack.concat([prop]),
                    attrStr,
                    isChildAry,
                    oldVal;

                if (prop === '-1'){
                    prop = dest.length;
                }

                isChildAry = _.isObject(sourceVal) && _.any(sourceVal, function(val, attr){
                    return (attr === '-1' ||
                            _.isNumber(attr));
                });

                if (isChildAry && !_.isArray(destVal)){
                    destVal = dest[prop] = [];
                }

                if (prop in dest && _.isObject(sourceVal) && _.isObject(destVal)){
                    destVal = dest[prop] = this.mergeAttrs(destVal, sourceVal, opts, newStack);
                } else {
                    oldVal = destVal;

                    destVal = dest[prop] = sourceVal;

                    if (_.isArray(dest) && !opts.silent){
                        attrStr = Backbone.NestedModel.createAttrStr(stack);

                        if (!oldVal && destVal){
                            this.trigger('add:' + attrStr, this, destVal);
                        } else if (oldVal && !destVal){
                            this.trigger('remove:' + attrStr, this, oldVal);
                        }
                    }
                }

                // let the superclass handle change events for top-level attributes
                if (!opts.silent && newStack.length > 1){
                    attrStr = Backbone.NestedModel.createAttrStr(newStack);
                    this.trigger('change:' + attrStr, this, destVal);
                }
            }, this);

            return dest;
        }
    }, {
        // class methods

        attrPath: function(attrStrOrPath){
            var path;

            if (_.isString(attrStrOrPath)){
                // change all appends to '-1'
                attrStrOrPath = attrStrOrPath.replace(/\[\]/g, '[-1]');
                // TODO this parsing can probably be more efficient
                path = attrStrOrPath.match(/[^\.\[\]]+/g);
                path = _.map(path, function(val){
                    // convert array accessors to numbers
                    return val.match(/^\d+$/) ? parseInt(val, 10) : val;
                });
            } else {
                path = attrStrOrPath;
            }

            return path;
        },

        createAttrObj: function(attrStrOrPath, val){
            var attrPath = this.attrPath(attrStrOrPath),
                newVal, otherAttrs, childAttr, result;

            switch (attrPath.length){
                case 0:
                throw 'no valid attributes: "' + attrStrOrPath + '"';

                case 1: // leaf
                newVal = val;
                break;

                default: // nested attributes
                otherAttrs = _.rest(attrPath);
                newVal = this.createAttrObj(otherAttrs, val);
                break;
            }

            childAttr = attrPath[0];
            result = _.isNumber(childAttr) ? [] : {};

            result[childAttr] = newVal;
            return result;
        },

        createAttrStr: function(attrPath){
            var attrStr = attrPath[0];
            _.each(_.rest(attrPath), function(attr){
                attrStr += _.isNumber(attr) ? ('[' + attr + ']') : ('.' + attr);
            });

            return attrStr;
        }

    });
})(Backbone, _);
