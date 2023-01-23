
function completePartialObserver(observerOrNext, error, complete) {
  if (typeof observerOrNext === 'object') {
    return {
      next: observerOrNext?.next ?? (_ =>{}),
      error: observerOrNext?.error ?? (_ =>{}),
      complete: observerOrNext?.complete ?? (() => {})
    }
  } else {
    return completePartialObserver({
      next: observerOrNext,
      error,
      complete,
    })
  }
}

class BaseObservable {

  pipe(...operators) {
    let obs = this
    for (const op of operators) {
      console.log("obs=",obs)
      obs = op(obs)
    }
    return obs
  }

  subscribe(...params) {
    return {
      unsubscribe: this._subscribe(completePartialObserver(...params))
    }
  }

  _subscribe(observer) {
    throw new Error(
      'classes subclassing this class must implement'
        +' _subscribe method; BaseObservable is an abstract class'
    )
  }
}


class BehaviorSubject extends BaseObservable {

  constructor(_val) {
    super()
    this._val = _val
    this._observers = []
  }

  // subject implement _subscribe because it is an Observable
  _subscribe(observer) {
    this._observers.push(observer)
    observer.next(this._val)
    return () => {
      // unsubscribe function
      const index = this._observers.indexOf(observer)
      if (index > -1) {
        this._observers.splice(index, 1)
      }
    }
  }

  // subject is also  an observer:
  next(val) {
    this._val = val
    this._observers.forEach(obs => obs.next(val))
  }
  complete() {
    this._observers.forEach(obs => obs.complete())
  }
  error(err) {
    this._observers.forEach(obs => obs.error(err))
  }
}

class Observable extends BaseObservable {
  constructor(_subscribe, name) {
    super()
    this._subscribe = _subscribe
    this._name = name
  }
}

function makeObservable(func, name) {
  return new Observable(func, name)
}

function flatMap(observableFactory) {
  return function(sourceObservable) {
    return makeObservable(sinkObserver => {

      const sourceValQueue = []
      let sourceCompleted = false
      let sourceSubscription = undefined
      let innerSubscription = undefined

      function handleError(e, sinkObserver) {
        if (innerSubscription) {
          innerSubscription.unsubscribe()
        }
        sourceSubscription.unsubscribe()
        sinkObserver.error(e)
      }

      function handleNextSourceValue(sinkObserver) {
        if (innerSubscription) {
          return
        }
        if (sourceValQueue.length > 0) {
          const value = sourceValQueue.shift()
          innerSubscription = observableFactory(value).subscribe({
            next: sinkObserver.next,
            error: e => handleError(e, sinkObserver),
            complete: () => {
              innerSubscription = undefined
              handleNextSourceValue(sinkObserver)
            }
          })
        } else if (sourceCompleted) {
          sinkObserver.complete()
        }
      }

      function unsubscribe() {
        sourceSubscription.unsubscribe()
        if (innerSubscription) {
          innerSubscription.unsubscribe()
        }
      }

      sourceSubscription = sourceObservable.subscribe({
        next: sourceVal => {
          sourceValQueue.push(sourceVal)
          handleNextSourceValue(sinkObserver)
        },
        error: e => handleError(e, sinkObserver),
        complete: () => {
          sourceCompleted = true
          handleNextSourceValue(sinkObserver)
        },
      })
      return unsubscribe
    })
  }
}

function switchMap(observableFactory) {
  return function(sourceObservable) {
    return makeObservable(sinkObserver => {

      const _no_val = {}
      let sourceCompleted = false
      let sourceSubscription = undefined
      let innerSubscription = undefined

      function unsubscribe() {
        if (innerSubscription) {
          innerSubscription.unsubscribe()
        }
        sourceSubscription.unsubscribe()
      }

      function handleError(e, sinkObserver) {
        if (innerSubscription) {
          innerSubscription.unsubscribe()
        }
        sourceSubscription.unsubscribe()
        sinkObserver.error(e)
      }

      function handleNextSourceValue(sinkObserver, sourceValue) {
        if (sourceValue !== _no_val) {
          if (innerSubscription) {
            innerSubscription.unsubscribe()
          }
          innerSubscription = observableFactory(sourceValue).subscribe({
            next: sinkObserver.next,
            error: e => handleError(e, sourceSubscription),
            complete: () => {
              innerSubscription = undefined
              handleNextSourceValue(sinkObserver, _no_val)
            }
          })
        } else if (!innerSubscription && sourceCompleted) {
          sinkObserver.complete()
        }
      }

      sourceSubscription = sourceObservable.subscribe({
        next: sourceValue => handleNextSourceValue(sinkObserver, sourceValue),
        error: e => handleError(e, sinkObserver),
        complete: () => {
          sourceCompleted = true
          handleNextSourceValue(sinkObserver, _no_val)
        }
      })
      return unsubscribe
    })
  }
}


function map(mapper) {
  return function(sourceObservable) {
    return makeObservable(sinkObserver => {
      return sourceObservable.subscribe({
        next: v => sinkObserver.next(mapper(v)),
        error: sinkObserver.error,
        complete: sinkObserver.complete,
      })
    })
  }
}

function tap(tapper) {
  return function(sourceObservable) {
    return makeObservable(sinkObserver => {
      return sourceObservable.subscribe({
        next: v => {tapper(v); sinkObserver.next(v)},
        error: sinkObserver.error,
        complete: sinkObserver.complete,
      })
    })
  }
}

function finalize(finalizer) {
  return function(sourceObservable) {
    return makeObservable(sinkObserver => {
      sourceObservable.subscribe({
        next: sinkObserver.next,
        error: e => {
          finalizer()
          sinkObserver.error(e)
        },
        complete: () =>{
          finalizer()
          sinkObserver.complete()
        }
      })
    })
  }
}

function catchError(observableFactory) {
  return function(sourceObservable) {
    return makeObservable(sinkObserver => {
      let innerSubscription
      function unsubscribe() {
        if (innerSubscription) {
          innerSubscription.unsubscribe()
        }
      }
      innerSubscription = sourceObservable.subscribe({
        next: sinkObserver.next,
        error: e => {
          innerSubscription = observableFactory(e).subscribe(sinkObserver)
        },
        complete: sinkObserver.complete
      })
      return unsubscribe
    })
  }
}


function defer(observableFactory) {
  return makeObservable(sinkObserver => {
    let source = observableFactory()
    source.subscribe(sinkObserver)
  })
}
function of(...values) {
  return makeObservable(sinkObserver => {
    for (const val of values) {
      sinkObserver.next(val)
    }
    sinkObserver.complete()
  })
}

function makeTicker(n, period, initialVal=0) {
  return makeObservable(observer => {
    let handles = []
    function unsubscribe() {
      handles.forEach(h => clearTimeout(h))
    }

    for (let i = 0; i < n; ++i) {
      const j = i
      const v = initialVal+j
      const h = setTimeout(() => {
        observer.next(v)
        if (j == n-1) {
          observer.complete()
        }
      }, i * period)
      handles.push(h)
    }
    return unsubscribe
  })
}

function example0() {
  const ticker = makeTicker(4, 500).pipe(
    tap(_ => console.log("source tick!")),
    finalize(_ => console.log("source complete!"))
  )
  ticker
    .pipe(
      switchMap(_ => makeTicker(10, 1000)),
      //flatMap(_ => makeTicker(10, 1000)),
    )
    .subscribe({
      next: v => console.log("sink tick ! =",v),
      complete: () => console.log("sink complete!"),
    })
}
example0()


function example1() {
  let ticker = makeTicker(20, 1000, 3)
  const sub = ticker.subscribe({
    next: v => console.log("coucou num=",v),
    complete: () => {},
  })

  setTimeout(() => {
    console.log("je me desinscris")
    sub.unsubscribe()
  }, 3500)
}
//example1()


function example2() {
  const myBehSub = new BehaviorSubject(17)
  myBehSub
    .pipe(
      flatMap(v => makeTicker(10, 10, v)),
      map(x => x + 3),
    )
    .subscribe({
      next: val => console.log("coucou la valeur est ", val),
      complete: () => {},
      error: (err) => {},
    })

  setTimeout(() => myBehSub.next(45), 2000)
}
//example2()
