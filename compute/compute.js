steal('can/util', 'can/util/bind', 'can/util/batch', function (can, bind) {

	// a stack of observables
	var stack = [],
		// the current compute's array of observed objects
		currentObserved,
		k = function () {};

	can.__reading = function (obj, attr) {
		// Add the observe and attr that was read
		// to `observed`
		if (currentObserved) {
			currentObserved.push({
				obj: obj,
				attr: attr + ""
			});
		}

	};
	can.__clearReading = function () {
		if (currentObserved) {
			return currentObserved.splice(0, currentObserved.length);
		}
	};
	can.__setReading = function (o) {
		if (currentObserved) {
			[].splice.apply(currentObserved, [0, currentObserved.length].concat(o));
		}
	};

	// returns the
	// - observes and attr methods are called by func
	// - the value returned by func
	// ex: `{value: 100, observed: [{obs: o, attr: "completed"}]}`
	var getValueAndObserved = function (func, self) {

		if (currentObserved) {
			stack.push(currentObserved);
		}

		var observed = (currentObserved = []),
			// Call the "wrapping" function to get the value. `observed`
			// will have the observe/attribute pairs that were read.
			value = func.call(self);

		// Set back so we are no longer reading.
		currentObserved = stack.pop();
		return {
			value: value,
			observed: observed
		};
	};
	
	var Computed = function(compute, callback){
		this.compute = compute;
		this.observing = {};
		this.changed = can.proxy(this.onchanged, this);
		this.compute.value = this.getValueAndBind();
		this.callback = callback;
		
		this.compute.computeFunction.hasDependencies = !can.isEmptyObject(this.observing);
	};
	can.extend(Computed.prototype,{
		onchanged: function (ev) {
			// If the compute is no longer bound (because the same change event led to an unbind)
			// then do not call getValueAndBind, or we will leak bindings.
			if ( !this.compute.bound ) {
				return;
			}
			if (ev.batchNum === undefined || ev.batchNum !== this.batchNum) {
				// store the old value
				var oldValue = this.compute.value,
					// get the new value
					newValue = this.getValueAndBind();
				// update the value reference (in case someone reads)
				// TODO: might not need to do this
				this.compute.value = newValue;
				// if a change happened
				if (newValue !== oldValue) {
					this.callback(newValue, oldValue);
				}
				this.batchNum = ev.batchNum;
			}
		},
		getValueAndBind: function(){
			var info = getValueAndObserved(this.compute.get, this.compute.context),
				newObserveSet = info.observed,
				value = info.value,
				ob;
				
			var matched = this.matched = !this.matched;
			
			// go through every attribute read by this observe
			for (var i = 0, len = newObserveSet.length; i < len; i++) {
				ob = newObserveSet[i];
				// if the observe/attribute pair is being observed
				if (this.observing[ob.obj._cid + '|' + ob.attr]) {
					// mark at as observed
					this.observing[ob.obj._cid + '|' + ob.attr].matched = matched;
				} else {
					// otherwise, set the observe/attribute on oldObserved, marking it as being observed
					this.observing[ob.obj._cid + '|' + ob.attr] = {
						matched: matched,
						observe: ob
					};
					ob.obj.bind(ob.attr, this.changed);
				}
			}
			// Iterate through oldObserved, looking for observe/attributes
			// that are no longer being bound and unbind them
			for (var name in this.observing) {
				ob = this.observing[name];
				if (ob.matched !== matched) {
					ob.observe.obj.unbind(ob.observe.attr, this.changed);
					delete this.observing[name];
				}
			}
			return value;
		},
		teardown: function(){
			for (var name in this.observing) {
				var ob = this.observing[name];
				ob.observe.obj.unbind(ob.observe.attr, this.changed);
				delete this.observing[name];
			}
		}
	});	
		
	var Compute = function(options){
		this.options = options;
		can.simpleExtend(this, options);
		
		this.update = can.proxy(this.updater, this);
	}
	can.extend(Compute.prototype,{
		read: function(){
			// Another compute wants to bind to this compute
			if (currentObserved && this.canReadForChangeEvent !== false) {
	
				// Tell the compute to listen to change on this computed
				can.__reading(this.computeFunction, 'change');
				// We are going to bind on this compute.
				// If we are not bound, we should bind so that
				// we don't have to re-read to get the value of this compute.
				if (!this.bound) {
					can.compute.temporarilyBind(this.computeFunction);
				}
			}
			// if we are bound, use the cached value
			if (this.bound) {
				return this.value;
			} else {
				return this.get ? this.get.call(this.context) : this.value;
			}
		},
		write: function(newVal){
			var old = this.value;
			// setter may return a value if
			// setter is for a value maintained exclusively by this compute
			var setVal;
			if(this.set) {
				setVal = this.set.call(this.context, newVal, old);
			}
			
			// if this has dependencies return the current value
			if (this.hasDependencies) {
				return this.get.call(this.context);
			}
			
			if (setVal === undefined) {
				// it's possible, like with the DOM, setting does not
				// fire a change event, so we must read
				this.value = this.get ? this.get.call(this.context) : newVal;
			} else {
				this.value = setVal;
			}
			// fire the change
			if (old !== this.value) {
				can.batch.trigger(this.computeFunction, 'change', [
					this.value,
					old
				]);
			}
			return this.value;
		},
		// The following functions are overwritten depending on how compute() is called
		// a method to setup listening
		on: function(){},
		// a method to teardown listening
		off: function(){},
		// how to read the value
		// sets the value
		set: function(newVal){
			this.value = newVal;
		},
		updater: function (newValue, oldValue) {
			this.value = newValue;
			// might need a way to look up new and oldVal
			can.batch.trigger(this.computeFunction, 'change', [
				newValue,
				oldValue
			]);
		}
		
		// triggeredOn
	});
		
	
	var isObserve = function (obj) {
		return obj instanceof can.Map || obj && obj.__get;
	};
	// if no one is listening ... we can not calculate every time
	can.compute = function (getterSetter, context, eventName) {
		if (getterSetter && getterSetter.isComputed) {
			return getterSetter;
		}
		

			
		var computed,
			compute,
			form,
			args = can.makeArray(arguments);
			
		var computeFunction = function (newVal) {
			// setting ...
			if (arguments.length) {
				return compute.write(newVal);
			} else {
				return compute.read();
			}
		};
		
		if (typeof getterSetter === 'function') {
			
			compute = new Compute({
				get: getterSetter,
				set: getterSetter,
				canReadForChangeEvent: eventName === false ? false : true,
				on: function (update) {
					computed = new Computed(compute, update);
				},
				off: function () {
					computed.teardown();
				},
				context: context
			});
		} else if (context) {
			
			if (typeof context === 'string') {
				// `can.compute(obj, "propertyName", [eventName])`
				var propertyName = context,
					isObserve = getterSetter instanceof can.Map;
				
				computeFunction.hasDependencies = isObserve;
				
				compute = new Compute({
					get: function () {
						if (isObserve) {
							return getterSetter.attr(propertyName);
						} else {
							return getterSetter[propertyName];
						}
					},
					set: function (newValue) {
						if (isObserve) {
							getterSetter.attr(propertyName, newValue);
						} else {
							getterSetter[propertyName] = newValue;
						}
					},
					on: function(update ){
						handler = function () {
							update(compute.get(), value);
						};
						can.bind.call(getterSetter, eventName || propertyName, handler);
						// use getValueAndObserved because
						// we should not be indicating that some parent
						// reads this property if it happens to be binding on it
						compute.value = getValueAndObserved(compute.get).value;
					}
				});
			} else {
				// `can.compute(initialValue, setter)`
				if (typeof context === 'function') {
					form = 'setter';
					compute = new Compute({
						value: getterSetter,
						set: context,
						context: eventName
					});
				} else {
					var options = can.extend({},context);
					// `can.compute(initialValue,{get:, set:, on:, off:})`
					options.value = getterSetter;
					compute = new Compute(options);
				}
			}
			
		} else {
			// `can.compute(5)`
			compute = new Compute({
				value: getterSetter
			});
		}
		
		compute.computeFunction = computeFunction;
		
		
		can.cid(computeFunction, 'compute');
		
		can.simpleExtend(computeFunction,{
			_bindsetup: function () {
				compute.bound = true;
				// setup live-binding
				// while binding, this does not count as a read
				var oldReading = can.__clearReading();
				compute.on.call(this, compute.update);
				can.__setReading(oldReading);
			},
			_bindteardown: function () {
				compute.off.call(this, compute.update);
				compute.bound = false;
			},
			bind: can.bindAndSetup,
			unbind: can.unbindAndTeardown,
			clone: function(context){
				if (context) {
					if (form === 'setter') {
						args[2] = context;
					} else {
						args[1] = context;
					}
				}
				return can.compute.apply(can, args);
			},
			isComputed: true
		})
		
		return computeFunction;
	};
	// a list of temporarily bound computes
	var computes, unbindComputes = function () {
			for (var i = 0, len = computes.length; i < len; i++) {
				computes[i].unbind('change', k);
			}
			computes = null;
		};
	// Binds computes for a moment to retain their value and prevent caching
	can.compute.temporarilyBind = function (compute) {
		compute.bind('change', k);
		if (!computes) {
			computes = [];
			setTimeout(unbindComputes, 10);
		}
		computes.push(compute);
	};
	
	can.compute.truthy = function (compute) {
		return can.compute(function () {
			var res = compute();
			if (typeof res === 'function') {
				res = res();
			}
			return !!res;
		});
	};

	can.compute.read = function (parent, reads, options) {
		options = options || {};
		// `cur` is the current value.
		var cur = parent,
			type,
			// `prev` is the object we are reading from.
			prev,
			// `foundObs` did we find an observable.
			foundObs;
		for (var i = 0, readLength = reads.length; i < readLength; i++) {
			// Update what we are reading from.
			prev = cur;
			// Read from the compute. We can't read a property yet.
			if (prev && prev.isComputed) {
				if (options.foundObservable) {
					options.foundObservable(prev, i);
				}
				prev = prev();
			}
			// Look to read a property from something.
			if (isObserve(prev)) {
				if (!foundObs && options.foundObservable) {
					options.foundObservable(prev, i);
				}
				foundObs = 1;
				// is it a method on the prototype?
				if (typeof prev[reads[i]] === 'function' && prev.constructor.prototype[reads[i]] === prev[reads[i]]) {
					// call that method
					if (options.returnObserveMethods) {
						cur = cur[reads[i]];
					} else if (reads[i] === 'constructor' && prev instanceof can.Construct) {
						cur = prev[reads[i]];
					} else {
						cur = prev[reads[i]].apply(prev, options.args || []);
					}
				} else {
					// use attr to get that value
					cur = cur.attr(reads[i]);
				}
			} else {
				// just do the dot operator
				cur = prev[reads[i]];
			}
			// If it's a compute, get the compute's value
			// unless we are at the end of the 
			if (cur && cur.isComputed && (!options.isArgument && i < readLength - 1)) {
				if (!foundObs && options.foundObservable) {
					options.foundObservable(prev, i + 1);
				}
				cur = cur();
			}
			type = typeof cur;
			// if there are properties left to read, and we don't have an object, early exit
			if (i < reads.length - 1 && (cur === null || type !== 'function' && type !== 'object')) {
				if (options.earlyExit) {
					options.earlyExit(prev, i, cur);
				}
				// return undefined so we know this isn't the right value
				return {
					value: undefined,
					parent: prev
				};
			}
		}
		// handle an ending function
		if (typeof cur === 'function') {
			if (options.isArgument) {
				if (!cur.isComputed && options.proxyMethods !== false) {
					cur = can.proxy(cur, prev);
				}
			} else {
				if (cur.isComputed && !foundObs && options.foundObservable) {
					options.foundObservable(cur, i);
				}
				cur = cur.call(prev);
			}
		}
		// if we don't have a value, exit early.
		if (cur === undefined) {
			if (options.earlyExit) {
				options.earlyExit(prev, i - 1);
			}
		}
		return {
			value: cur,
			parent: prev
		};

	};

	return can.compute;
});
