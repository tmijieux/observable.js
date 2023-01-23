
class Observable {
  constructor(func) {
    this.func = func
  }
  subscribe(observer) {
    this.func(observer)
  }
}



function makeObservableFromOneTo(maxValue) {
  return new Observable(observer => {
    for (var i = 0; i < maxValue; ++i) {
      observer.next(i)
    }
    observer.error()
  })
}

function makeObservableFunny() {
  return new Observable(observer => {
    observer.next("joke1")
    observer.next("joke2")
    observer.next("joke3")
  })
}

function makeObservableLent() {
  return new Observable(observer => {
    setTimeout(() => observer.next("1"), 1000)
    setTimeout(() => observer.next("2"), 2000)
    setTimeout(() => observer.next("3"), 3000)
    setTimeout(() => observer.complete(), 4000)
  })
}


// const observable$ = makeObservableFromOneTo(10)

const observer = {
  next: (v) => { console.log("next v=", v) },
  error: (e) => { console.log("error e=", e) },
  complete: () => { console.log("j'ai fini !") }
}
// observable$.subscribe(observer)

// const blagues$ = makeObservableFunny()
// blagues$.subscribe(observer)


const observable$ = makeObservableLent()
observable$.subscribe(observer)
