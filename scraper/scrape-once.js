// ONE-TIME USE: member list hardcoded from DB snapshot 2026-07-31.
// Bypasses /v1/guild entirely. Delete this file after use.
// scrape.js and daily-scrape.yml are completely unchanged.

const axios = require('axios');

const BDO_API     = process.env.BDO_API_URL        || 'http://localhost:8001';
const REGION      = process.env.REGION             || 'EU';
const SERVER_URL  = process.env.CLARITY_SERVER_URL || 'https://clarity-guild.live';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;
const TARGET_DATE = process.env.TARGET_DATE        || null;

const LIFESKILLS = [
  'gathering','fishing','hunting','cooking','alchemy',
  'processing','training','trading','farming','sailing','barter'
];

const MEMBERS = [
  {"familyName":"Abbehh","profileTarget":"tbXSK7e39Sb3U3yPi7UDjlKbK26zq+FrXBIr8cK+ofIIwWecAxuy35zpwW9hD9nEYNE4jn7BY1BH2wx9Sg/+Eeh0RiaM6eSfsNb4QhNWyszfeakz5stKcAmO55odTt0iwMZuwn3mpiPPtUvabxbgcugTCO/BEMzFeRRLvWRpAJ8="},
  {"familyName":"Abysus","profileTarget":"tbXSK7e39Sb3U3yPi7UDjoGrPp/REmAvcnev8YK1vl7IDF9nHYTiv7xpOHsSYqNXXfyrnlEPRvJyxwvAU967VHgvZ63+Gmzi2SrvspP2uXYIiKpVj4i+JC36QRWhh17MO2lQjlWbQ2nHSOIhDzfhFo18Tg9OwbM1IMWRkaP59ho="},
  {"familyName":"Aldgate","profileTarget":"tbXSK7e39Sb3U3yPi7UDjvTwmO+bY+nK2OF/QfJvq5H4I6gUt1ebk2hBt6mt0xJk3rKwyaVerUD2bmbdeTDQJrlmgh4IK1gVZEShxsgDN/R/cDSQfdhSdlHOJEHc806rHSDlCEpCQ1wK0AvZYP2nwwn2A/x47Up1aJq+2vHrKIw="},
  {"familyName":"Anpex","profileTarget":"tbXSK7e39Sb3U3yPi7UDjuxer+mL3CdDjtzPh4vF1GL0YK+PB72jQKy9k2CsiVCruKpMEwjT7exQQ090IWEhV6PKDA7YCvGqJtwG8unjkpuwogaotQw4DMxNnkd9z8kbCSJ/04zk3gt3OAhryElb+4vFU+TSsfq1ccPBrgv0ckk="},
  {"familyName":"Apfeltastisch","profileTarget":"tbXSK7e39Sb3U3yPi7UDjnCYLf1Gouk0VYp+Mq4JI8dXYXiKonxec9nhWvyonjv9Ufr77XyDLKiZ3Z24im15GQ204Xa04feZfuRMBXhQzVERx6kUqjOtcmCE7VQaRbLv39soevKQ1+JIuYkkEF8sbKY5TEfLeV6o/KemLBvIzfsocKazT9EbwUYjRpVtSg6K"},
  {"familyName":"Artur_HO","profileTarget":"tbXSK7e39Sb3U3yPi7UDjjN4gT3Jr7DDxq2+Re2fxOJuEK9BBtaX05HkYoqb/5+SuX7QKjWeC7UVVrX2s/RROxpLaP8FmguQuJ49JzcoQOneO8PAriy6IxKyBv79BEy86q9ZuuaibdK/B7AlP1sBKhHl0+N+JaPLB7NThgOlGsHlLnJjOXRh5bLwJ9S6ekYJ"},
  {"familyName":"Aryn","profileTarget":"tbXSK7e39Sb3U3yPi7UDjpPVFnXMcV6EJ+Y2f9hXCxuwsHn+bNTTzVX6P14yIZDATY86R3iC2TUjKkK/BAqvnvi3svu9qZNyAM3Z0Xtr5Vc0Umd9PcpfiNY6L679PvDTkXybtwMrwpWw2Ible0HGBZ0GjglbLI8sGdtBQrGXE5k="},
  {"familyName":"Atare","profileTarget":"tbXSK7e39Sb3U3yPi7UDjjNnG1s/nYLGh0Xm5mtTazcKAn4uXvPYRMrMZ3jo+Y4FnIDDIOVGr9GS4s0Llnpxy7Xa3SaNAbBkSBbPKpqPdX1YIbD+2S1Ih3ajkBFNnKq+p6h/h/HgjmJT7QwJq/JKwXlmQ/8XewPtnvRkpFd7faM="},
  {"familyName":"BeeMiner","profileTarget":"tbXSK7e39Sb3U3yPi7UDjvbvJJQXy7cETzu6yv7T3oYtM5Bb/k6/nZulT6GGtt94JZoMuWcZMcr/KV6f1LVyG94DN5tWvvDjFSvxYT6dxd7vmen7Oopsqbz3p3DbfpJscOrHknt3cuo2Rn9KMggsl98jaS7hqhJCbRIMqB7jUHL2/zLTY56LB74/T1svjsNN"},
  {"familyName":"Belthar","profileTarget":"tbXSK7e39Sb3U3yPi7UDjkFkIOPXuv/H5Ommdc39P0qH9cclWoWbfWiG8npn/vtU6Pt9nH7WehhzeX+qej+g+0xeYhsjE2y5lOdZaCE+AfWam4ijiZpBhvBvMrStdg9lTamuN5VnxkStFllxvFIEiCUgeYkFlXyMua5P0oVT/0c="},
  {"familyName":"Berenjenators","profileTarget":"tbXSK7e39Sb3U3yPi7UDjoz9Fz9Z+MjbBIiAQJtOHQnZpu55tKQT87gmhTO6KQf70Q8n/L5nrIg9QKb9/e53f76KG7/Pryu+YSth7Qeoifc5/aRhhZJhbTBNdnioI6cAfjjBdqGg0x/WJcpzv2yh+TtxK0w3QEhEaHSOoL82IZ3cegIi9icapxjysbj6deNI"},
  {"familyName":"Biblioyama","profileTarget":"tbXSK7e39Sb3U3yPi7UDjs57BVc4Xykd9ejQqas+nLIHwE8fJXxg1K7TSajU8Lo8nd7sRQ+bLl5rJjrb3ZKFEvGyu9kUHutrLS3In4KS6Fx4nnH685RSwyH0D0iwZAYMekV86yq5egFbxeDpouKHB8DJHuO95g98PdiJZ3qKFGPIoi4Oe7L5msHvGS+m7gf1"},
  {"familyName":"BlackDiamondCat","profileTarget":"tbXSK7e39Sb3U3yPi7UDjnm6oYSHZw2Iw9ofHo/EegTCNsEjbG1A2JVCjAKZ4csV/i0lbqla2bdiIjVh9c1gjZWp7ZZ6HvrFwxdR2Z6FRoPWjcyoX4QQ2jnjr+WNJAL5E2cd45Yovq+yQRRoE4U8G26IvcJjluaEcxwCKAuZ7hnxyYN6ej9QhMuV8SRJFWdR"},
  {"familyName":"Bubblepuff","profileTarget":"tbXSK7e39Sb3U3yPi7UDjuHRRB1A6UJhzTlOPQVjzg9kybbCeTIJiozWbk1JtkFoiHisOgCELmEDyZrwKd2AnHc2M8W8/6lKuapKcVdqTLDDbY0MrqjjcGhiBR/HGBnSDHVtS8YdrP6c5tr4XKVdpsE2JPLM6BbZTGXwnEH9oETxS5cCuaGtfNq8LbO6+xnQ"},
  {"familyName":"Cervesarius","profileTarget":"tbXSK7e39Sb3U3yPi7UDjtcXsXIWZwoPE1NgYnzEe/Wro7FHtK+cduNMREHy4xul0+uJTcAkqz6VG1pL017nq6e3KYliQlJfq2SIJqNv2+rbaqOB14lWd8lP+1lPROvN8MrWShIAIthpREo0jxYlhNQQM1TTSA+dTnWuZQBNOcXje1v/uI18ENIbGjaA0yCW"},
  {"familyName":"Chiefs","profileTarget":"tbXSK7e39Sb3U3yPi7UDjgLNh2/+opnvyW60oP9mmiHU19EaqrJtwTRWtutUkJ6EiEC9ZqzKKjSnynpHJUTCGoIN/wjRfeS9QoTIP/GtqQClMtGQbPEbQH7JJXMovohDw+3vE4tCcKoMxZkax5xU/hjBivuqVe3gdHHclO0FgaE="},
  {"familyName":"DMUK","profileTarget":"tbXSK7e39Sb3U3yPi7UDjjnDSDN+HlDGeKJyC3kCtbSMMgOg0m/WDXjT38+6pqrmBTWbBcZO3PJgs9WTrlJoR9Falm0Kf2M4X81N022RBXu1FkLrACdmWmGeBUrtk+PkUfKQxJOf6OqXH11gJCnkRaqLu/WwA4jvBQkHfQpJeZ0="},
  {"familyName":"DineroDinero","profileTarget":"tbXSK7e39Sb3U3yPi7UDjgiF8uIh6+UWdcRf5Ap+68eL4lIuZA5ZfGsAv6EcqkbpMV91Colu8JbAemsRHQYx/ky8xebcE/4zzccHBX5JDXce/8jmqj2PFerfVvQbNBK3Mo751J7pCfsEB1EvHYuJXuP7TDdI2HNUWb9NTq1vVMlmN+KHXC8YYH46KmYCTqpE"},
  {"familyName":"Disco","profileTarget":"tbXSK7e39Sb3U3yPi7UDjgroGRKGqmXzakVDugqCign0sSGdktJYglGJr7WedNEozVvvWs6PX0N6aK5tapSnjItpQU2SzmyRmkATPTW0/qn4X/LTlbl1lHkd5uJnrCQ/9W0k6lKnevaVLiM8u34Qs967XqVwhU27jTA/UAi+zl8="},
  {"familyName":"Eldorado","profileTarget":"tbXSK7e39Sb3U3yPi7UDjhicsoWNO+FDGEqzo5JNOexkvIdmDtVN/3rr19Cpf4R+QRRmDvLH03c7lFJ2+skfkAmBe53SzftdolbIHQI/9QqHDp740xapTEZQggiTXm/5k4Ix6SdOAgEvPzc3lNaVlg6PSEGoAeVulpVe3qm2veujaCKOzQHSqC6OaLAQGvbX"},
  {"familyName":"Fakers","profileTarget":"tbXSK7e39Sb3U3yPi7UDjgxnR2JZsuqBO12egSfmtbVH07qBi/aH6FAn1UVZX2A7l/ejpTw51VJa70IfO8lytz0WdhyZjRGrDQc3cmC4KSBnbSLJ60dC54CJmOZM97I+9bDZrnUBgRwCiglmK6M3eMYfyM2UwS8mB6+lIOM4fEQ="},
  {"familyName":"Fasii","profileTarget":"tbXSK7e39Sb3U3yPi7UDjiULrzal84xAil0k/Yn2Y6HxEXjexZM3vJ2ZZ5h7ETWlfaTdXXdmRx+pMK42qaP6oJ7lKiCGkDoFRE27dcCqkA5kQ7DhMF+YqAB7H+RCk8v2V26zfAjzxhUivgYLHbs9nwRSTLDhKQA56jMnIxXJjno="},
  {"familyName":"FeIurian","profileTarget":"tbXSK7e39Sb3U3yPi7UDjof/AEmmoK/Tn5IEsjjP0SxVf15ygWAxqGEwhJJsJ+A6G68/xss/PccKcA6aq4hxyxx2rSlqAjFQbai4dhc+mnqFumKPYaH+qHCDO7D19JFSrpYCfwCnJEJXVDvaSZBFUYchUsk4gBAuQ2nbZgccNo5phFJYmkGyhhn0hYTKMjal"},
  {"familyName":"Flcknbrgr","profileTarget":"tbXSK7e39Sb3U3yPi7UDjuJyBy+kZPtbWOKLJNL8w13yZUQUBCJCZj4QTjhwjOx/ze75R8U6hRJOjj2/KGK7GCR62hwP9S8P5KjyaPS+vZAQZzuaKDMRk8BOZRyMCvSfvsEyEq9zwV9VGawbK+mzPAfEWEDh2cbDDu0RO5cPcaO2TBbl6Hax8n2LO/W9wa3t"},
  {"familyName":"Flebyburd","profileTarget":"tbXSK7e39Sb3U3yPi7UDjhjECRClYi+HUZz9XlTAjJJbYTsjeH0v6niPZuKNtWMIsfXMIX3uJaSCkQO18cLagT6TIJX1XqcP1LjU0zFA8sqGWrdfp6oLsuBkkJyKu7D2839pCkM9SK7V/e9K2wE3jpWDoGaYYYtGchyuxlidDykKv35b+zOx6pxc1InYrqyU"},
  {"familyName":"Fritze","profileTarget":"tbXSK7e39Sb3U3yPi7UDjjzNejZu8ZJlicCnR0Ss57HfRMnigZpgASkfG3pKwoZ+ZNvoarwxE0SNFWfv4xVzhdAwqcFXiQr4jLXEuT2QZyDyOPQB0AmjE29P6h1PYz0/jGMt4qzukBEh//vy3TEXYj5DvL4qPkDex/cLhjzS/Tw="},
  {"familyName":"Gaxo","profileTarget":"tbXSK7e39Sb3U3yPi7UDjkSil+z6bilGj0tQfm6hV9uBYL16xThiMFv3JU5Uc+BJJ7vAucvkQaTDmCU0ie+D7T77XNGCUNGI4OvzToUrKDgwY58PS8qepywbpmoLOh1pOMoLqm8OB0ys2XKZtYsGvZwGAVD8kLmxi9DGQbom8Ec="},
  {"familyName":"GeoVai","profileTarget":"tbXSK7e39Sb3U3yPi7UDjsHVa4crw3jHipLe9P4Yv9zlooMUnKKjXP1F08Om9GN9P0057qV/kIfr09YLSGwvDs8PZAAvxSrSiitl89wdwlD84lAOTOXa30xc35XG/qB+udL9k8YtVtfSN7O/W/W2V9FIFSPBjpab9qAw7Nu77sI="},
  {"familyName":"Gonyor","profileTarget":"tbXSK7e39Sb3U3yPi7UDjjytIrU0aS668mpkq4Ugd6pLABnDnE4Pn8uEn6vSIVUYJjWzSmTKGF2P7ii2KdJvMvDJBlIL4gE+Dp8A6+yWEB6AG0V9tC9c53on3EO6XwvTtptASZ0b9yrIoYB8fzFwxvzxxM1q8wyHUbsdkYo2noc="},
  {"familyName":"Gottesgott","profileTarget":"tbXSK7e39Sb3U3yPi7UDjsPk13nLwN+a9LCj4m02Y+SEliDEarrCQMVQWGN/4+nbnctLiKtwR+8dzLBNV48kt30HwRkPgC2aJ1/35WTM2/oberLha0czO9PQsazpmVvqPag6NnTmjDgrvT3MZqvull1yNDXpxrZlC+XDnMTeRk7QoYtz3gcd3zuB3jC/pZHw"},
  {"familyName":"Hatemost","profileTarget":"tbXSK7e39Sb3U3yPi7UDjhw1ITu09pNcyPQh/0FQXkI9KLQ+VZaxcbLYeoWAM+925ZylGZvISTa8GikKI3OYhdtg9RaXWMosAkWkNU97CnD5n9ZiJdgR0EMGyRFzYBdbr/GEGr78WZyYH5rHfuJUy0VnrT0HrtlNe/P1eorAmnhT/UJEcIkP2H137Ac/5Rup"},
  {"familyName":"Hesj","profileTarget":"tbXSK7e39Sb3U3yPi7UDjtFuSqJxyWZgECFbr7N+6mXztuH8n5E9ArM1h4PUL7MSqILoYHke/M7fIt12AcnftB4vrk4wnosdE+qV3CSOOBUZYD3NNguIjlfDd3tQHNJUYjQhtecd+tgoXqnU09WchJFlp/9fDNtMnQSwcGpKeGI="},
  {"familyName":"Inanyx","profileTarget":"tbXSK7e39Sb3U3yPi7UDju1bUi1zw49uJpJV7dkI3af39jg+kok60fkmoPkYaRlk1SZ1NzvhfMVYmdmrqwdreXpCRWnJJXWrCEpWzzUP/Ye2S6BqNwrc71pT74yGLpRQzcWs3Oy+Feot5fb/Ifrhmrv/WSDUSz8os2O1pE51L5I="},
  {"familyName":"IntingSmurf","profileTarget":"tbXSK7e39Sb3U3yPi7UDjnggi9pR/3ngnxEV0QUHPEhGWErSUc2E/snXNz6d8juoePVQ91hbtRvwL06VlvAZfAFNfZCDl5ncCB7sc9z8gyvIpYay0XpvzoXZb6pzCAoBNUkrpeQ+Dbur+9Foib5P+yQMfHo2zoD2OLv04E53vE1SyTF2JY1Rm9iFwcF5z09b"},
  {"familyName":"Isrichtich","profileTarget":"tbXSK7e39Sb3U3yPi7UDjsnQPXJChGNFFo8qPwqnj1LIO7banqr903X0DJPKoa5SrO8Cd1lr9b6kChFg/p6wd38Tzo+fNtvLviPsJv5k3ffL+a+/nBoc6NJc+3VjyNqM69Mrm9dEsrdmQePJ8sho2H7DtdjNCDootHaQgYsPgyijUC6drhY5vIHCjzGB7S9v"},
  {"familyName":"IustinWtF","profileTarget":"tbXSK7e39Sb3U3yPi7UDjpnVA14bxYDo9JLDfjFNEVXAzveiS7H+eO3bwRFlHCpBnj5Fve5YvJECNgijdcqM5NYJ2/U6Jn92a4WhN9rF0/O0JaqRtkOaciGRWKak8oakU1Dm/Echwd89dJdatFmV4ldeLhW2l+Wt5w19f0tvhWuDJIVR6kTobl4pssDOogAK"},
  {"familyName":"Jimjames","profileTarget":"tbXSK7e39Sb3U3yPi7UDjr4P9Ef+gFQenmEj7G/bMc0vxpe2big8vji7X7ttcTyq3p98+rpd9DUMsr9VLmoKB6hkunAw3fiDmlSJq+WEBXEyQhSoNuzfhsfpvxrH9A4c0+W/8LwunHwdrYvSwnQAQ0B7o2dR14+lOAXb28uMAEvydlrTBoyWF0O4BuUZWEke"},
  {"familyName":"Kawai_Boys","profileTarget":"tbXSK7e39Sb3U3yPi7UDjoxt69K757QCckzI4EvDkA65IwGWTWRtJUTWjZfXlgW0/7xBZ3ly1Yn0SF6Puv2kdDEQU5ud0lANPwX44fZkpxZp4FSyQVWJORdOCxeNJMoXnoNcY4+S9XzYxJ3LvWAFLtdrAA61T6OmF/ZabEv8s0exmwn7T64Ak2l78VHfthz2"},
  {"familyName":"Kazzazel","profileTarget":"tbXSK7e39Sb3U3yPi7UDjuVCUbPEQn6++xXoy165FwNGC8UQ9TX9fScB9051pH6K3CbdIX+oVuXNFLxBgU8Du7FUddbRL3H01v8TJQ8CmeTQs+HtTZVTC5UQN4aI0SFjFsv7nQvFnQ7maj8qdxyvt/yKNKk9bRRHJ4SJCcQpoGZOWFnk9VnkppQontDuKtA7"},
  {"familyName":"LANDMVRKS","profileTarget":null},
  {"familyName":"Lechki","profileTarget":"tbXSK7e39Sb3U3yPi7UDjgvxt5sMdqpY3p7CrhEsUOMUARRFMUYx5mhvGU6iZN7gO5eBBA9cIvBQ3gCzt6lJXZQ7hcI3kyOjDBKpGeGYUSzNdFZE1hqPZtS71nhXJwzie2m64+s4wZq77+nmhkauCufwShSP9fMYqp8/pb/eL+0="},
  {"familyName":"Len","profileTarget":"tbXSK7e39Sb3U3yPi7UDjg2VSLOpE+ViBWRPOyKN0Jx4w+8Xgk7UqdBmnpY1yK3PN+o0C5aPPAP/pF/oaRwwv6SDqEdT4xN85Yop2aDfa8uFnIxCYV4HdEurwZ7/7+eSw5FzoCGuFS/BED8zhR6pH51tM1Ttu1Im3RDQoDWyEwE="},
  {"familyName":"LyxSlash","profileTarget":"tbXSK7e39Sb3U3yPi7UDjn01DIcPL6B0IZmj9IZUghQpt5pA3CAb0VA8Nj3e3UTdb50F282BG5DqPWjChlbT/GkXbF+uGYuSaxpI2UD4KDBMBWdCXNAvrcN03Uq3yxRG13ywBHlOjg0VSsKQ4QwTv7ct+OKWssHGq6CkbipHDrijeejRWGrHphjn4uUzWiR6"},
  {"familyName":"MRCHOPORDER","profileTarget":"tbXSK7e39Sb3U3yPi7UDjhLCwmCxUqvKT3/OhnzyTH7+YVU1YiPRLVUX9ihzspas6w+FMrBKtU/YZWt1/NPCAjtHfLWCfuHVDjRy218BdP3u70j7ykfAIS7t85jxO725LdIfi6jMx0BnE7pRK/4PETyn2UKMtv/pcPbhCPOmFqvEIb9n1JZyNaYbROj4b+yo"},
  {"familyName":"MajesticShadow","profileTarget":"tbXSK7e39Sb3U3yPi7UDjqaYtHKthfeLwd6EJN/JMok32hfsV8ShFz/637IUfCpLNPCcwXKc+8Ma42UNkdBekkRhgaFUFgc79MUQqkpVLUEathyn+MS2mEu6111N9YeWAIZUDMu9K3YbEncXpvXPrV7SHnXAOJ21vpLKD7Toe5B8tbU2okpAcYcdE/aIl/6y"},
  {"familyName":"Maliony","profileTarget":"tbXSK7e39Sb3U3yPi7UDjob1sxKI5v5AqfZnJS69lOS2h/dkmB1De4V2/Xz0X/sM/TVpejs/jarrHm0EwtKVUx8ENBH2JN/IIBI0fuRZUtkU5i56JyyPnt+eNiCgmZ2p4nFflhQBXQVZpbLpjGQA7upybwWPHYWJkBIvO9hRnF4="},
  {"familyName":"Mondlichtritus","profileTarget":"tbXSK7e39Sb3U3yPi7UDjnm79ehxDkWHV++wib58HHgsoFk185zxMRZrlHhg2mz+uib6OObnct3xswr+EdiucxyfpfSwiyruHvnccyOMe7KUbW3orXkIp4UcPobqmcIwblsuJU1a6Y7eGhXWydyp8JDrdeUgpCGKKKE8ql9QZfy8FvIvX88939g/agJghAec"},
  {"familyName":"Mortem","profileTarget":"tbXSK7e39Sb3U3yPi7UDjihVsnKojkoIWoDDaQpujjZq9aj3tTEeSm8mL9mzFGN4ZoUS4ZcdIaUcQ+KwzHpIVQKaFXqZizU0Sf995q3vSKIsuMTQO4dSCmHklfabgA5VDAYBFZg5ZNDaVhBr0rE4BIhZAEAiIkSNoMIW2DYmVXU="},
  {"familyName":"Moudada","profileTarget":"tbXSK7e39Sb3U3yPi7UDjgdv7J4/3geBjX7QbDfVFeVg36vHcNktrfxmsIdNVh1OrtaPq+oXdqwBOHuUTNTKAM3TKXy0EZ+wXsAx61tUX9+deHEaLdAMwOMnTawg6p2WoSQPAdMfLDkw8sp1mlEa5YmJaCN1V8SiTGZ3Tbzn0wE="},
  {"familyName":"Mub","profileTarget":"tbXSK7e39Sb3U3yPi7UDjh1x6rRLXkJGhHtINIK1kZkAs/13NiNU1EZebFpAEUrfuORjZOJfXfbS0gmEHV7+z5qaz5ahQOCF+VK7Am+4i2IPGE9P8QzrVDKItisWuugzVk3+6bvj9x5XdkAhFzmnXr6DZCSjkMWyeQOGa8IcbuQ="},
  {"familyName":"Nemeora","profileTarget":"tbXSK7e39Sb3U3yPi7UDjlp8Ap+hVSdTXOpunC2QH9qhLovEIDCQQpHIxN+R28zBrEAJ57PxDaCvdi/qfg8+KP3mHUydMJBPJ6kYO1rjwYEFjW3zH7hm1YjtzisQMG3CcCMnISvnk62VAaRBp+zIS2whY+HS2rXESCwfpRkaix8="},
  {"familyName":"Netherworld","profileTarget":"tbXSK7e39Sb3U3yPi7UDjsq1+HfHv5yB8uvLDt2nKyeEkDif+yefjiUSe1d2UKnNCLdaQuB4KFYEQcjb+1ufj3PHqqGwNA6CvEntpNyWrSG15xUB5UIFz8V5zDESpAmQrV9XnLPAEQuVZWQ/IGtuLQOFeeYZTy3Bmp40uWkXa/ijwMNQVVAIki/+na0/R4jL"},
  {"familyName":"Nnjami","profileTarget":"tbXSK7e39Sb3U3yPi7UDjjI/exRmAWRMSgwgLA+VBF70kO+eXvrubedRrL/vsl7ePySTHzfJQ5crWhGZb/tSG8KmiEW83SKJGzVGtwCrI1iGsTkU2yH1iVgKWlxi1yRV5Iq6YfMp0EOQ4oZ4IrW3UaBZmGjvk4PxZC684NnS+WM="},
  {"familyName":"NoBedtimeGang","profileTarget":"tbXSK7e39Sb3U3yPi7UDjnpOr3oBn9kk3IpP1tbhf2tclrvElubMbJsE9safdv4ZC0kd+M72hZzSCiuu2HFnQC7cczbFN41hnBAA6AttQLuboGHY0gMjimPdjk7V9Xv3em4KFdfoNcB5fdhpxaF3/dzP644FZOJ08i9wSRWAQg3Zw/2o0pjltzprbEv7EZBK"},
  {"familyName":"NoiseFlow","profileTarget":"tbXSK7e39Sb3U3yPi7UDjtiDbHS13+W6d70VuPMCu4ST1wDT6Gn9vx36yJM5zksfM/X5Z/0AgXRK81TUrfQbkSckcpT2A0IFu3xhFiLbXefODDsTv3EqAIXuL3KIRdWQLFmAlFkimUfWbl1djz+mVOfaeI0OuJtUI8Oww3mM04WUD5kMO8to812E9Skm6dfB"},
  {"familyName":"NotClara","profileTarget":"tbXSK7e39Sb3U3yPi7UDjpKyy+BNhdFNoBC6MBaGxAhyv0L08R5+yDNnRBE1a3dQPJ1JrFY67oUwQe8siNkXrHVSq2Nv8KYsAkFAn3dh3o+qdIkiYPdjsOlZBmX4BDNkdfBBm3lDeTeWVxoT2pco/lFrCD/fxcrWWA8Zv5N2bbjzjx+6Ssq6Gt3P99z/Fapv"},
  {"familyName":"NotWarflash","profileTarget":"tbXSK7e39Sb3U3yPi7UDjris1Hj4HLhvBghh2yffcmy+M//YiQnoGzwCIVko5oo5OZLFYhJ3AJ8TqJh3CfPbdw5Z/LDtHGCB+kiDoA07Mfnzu1Mt1dljGUHETZKJuxMREk/CivaSO+Cb7dM6ycReUtCvN49iq1VDz74uoWo03vXJn/81+9vPAMmbwvaq5hGb"},
  {"familyName":"Otelox","profileTarget":"tbXSK7e39Sb3U3yPi7UDjqG+W5hQH5UI6eaeBJ+3l8FfBhlbANZrLiBprQmNIcqKRR4WcKbHCDbcYJ+IscF6Q/jquygHFX/9Yz3Hj+L+r7UoBzhoNSTu/RhuRt+qXwO0v8VaYU1Rj+DiUNVE/mD2Pr9gypTwrlOFq/sS4MGzcuQ="},
  {"familyName":"Paghur","profileTarget":"tbXSK7e39Sb3U3yPi7UDjhafOjWZ9OmTlmCIRPvBx6FwtDfJwdCCzRaM5vMXtV7GlYyGAoI2ejblx/EUf7SG9ITWSuJskVbWEGE9rutseV1pQAqvby4b/EsTCwNIOXOb/zTwObVWM1zR6caXi/lyLMukPMRQdV8rvMZXfAeE2ck="},
  {"familyName":"Pars","profileTarget":"tbXSK7e39Sb3U3yPi7UDjosVxDVZOWJ+IrIMV96io7AF4yfJLD00e5HgbD1ZH4w26kEpclpTplpYwazgH8BbXoMzP+NJpZoBgJOffKpNwMg1wrPK/svgtZ8bVxsJtloPZahMmESiGS4hUfzsp67eE87fHL2g3WOc6leg6pr2LbY="},
  {"familyName":"Permafrost","profileTarget":"tbXSK7e39Sb3U3yPi7UDjhlk+mNEWA6v+v53Y8qlpcKtlz+qh5DUwwkBnhbBjYyiTpf0GCOHGzuthSQbz9vzPYudnzR/6joJQ/7GzCCV0qj3Jv+Nn5K1FaxvcDMjY/xtSzGncA3b2obCOmjqk4bzb6D4jONCcSIMO6tjuv4H+AxTee2ZRnHdpQHHj4BKF3nm"},
  {"familyName":"PesteNera","profileTarget":"tbXSK7e39Sb3U3yPi7UDjmFbADtpy/UZeHBnTcqLs0yxYbkNsqDbDHvcbRx8Ox2ZVgmo8+fxRQZaoYyTl+CIngrM/bP/lSvbnUnoFj1rmLgUC4bOTyYdmPZmKtYMVoSS3vV0l4VUs8aYtgbTmGd1w0UmbjXkI7/819z5JeZfS/ALTpYJbcaczy215667hjvN"},
  {"familyName":"Petefails","profileTarget":"tbXSK7e39Sb3U3yPi7UDjpu0FyDcF9nL8a+cEjIJ41GTnml7WDTZFrhGNDRe9A/XA4dMxcoxpJHngkEmJcWwIFMfKPE5tMYDjSbm73kqQqMSapR3SqyAAHVVhd0Z4/3byFrMEJH5hUR71UM88s9E/i61Xk85Pf9mhmYPKtTcbt837h5rEa8qxnxWF/8t8he7"},
  {"familyName":"Pinehelm","profileTarget":"tbXSK7e39Sb3U3yPi7UDjvNp4qhoNl6d+j7xX82v1o48NUmcu/7li46Tk2XVHjfCapIfVczfUbe03/ISh7NNT4hQC6IGF2bKHmZny3iZew0gWdzXjolZjEUoaWCDPkEGbdw+a6SXdWGxwB+uNx7dEmKjAKsGuWVFZvuz17hC5Hde8ALPAeKZ+PzUvwlgE1DJ"},
  {"familyName":"Quanzhii","profileTarget":"tbXSK7e39Sb3U3yPi7UDjuJkYtRKcd9eoJqtzF5hzE7RqNhKqkf/7bc7Sr9Ron1vqIqrCuENyxMV7JfqAWbJwwfZIgaXd2XDlC6EV/uorG50LYWQhvwkLzEY7dGLwCYC4HoLDcrbz0hfYPHdYCn+Yd/LKqecKa8ISutfI+OMw0Iucb8XqnmpN+4YX/bRyVIH"},
  {"familyName":"Rejoiners","profileTarget":"tbXSK7e39Sb3U3yPi7UDjusXZ9Gf5LoAXn1u4ZBozr/2aZsSQ6FASoSxnOe04k5Gzc+ZdVxj/VGkdJL7bpZ614XuF5Yjfsnlt7isb/DNZWYRRLuFTmTHe4tvF2c/UfvqqJQ1lG0HRYbNdb3h2HRBPtoV4yDTDOOsWrKxkv/shwwuFLzyp4AKDFtn9ynW61Ic"},
  {"familyName":"Roksu","profileTarget":"tbXSK7e39Sb3U3yPi7UDjjQhqz2J1YvblMxb48a5Zf9H+JckNzAN+5hTts4AK/gaFG2AzBlgiCjZ+nguzmmwRl64SV838LeX+8WF91430pgACM5rOeONyKBuoMlu3MKPQXncTIGBreg0N4aoqN02uwJqxB7y0VHZa38VZvRkMQM="},
  {"familyName":"Rosenquarz","profileTarget":"tbXSK7e39Sb3U3yPi7UDjr8VbTpc+YXxaxd4IGk7cNroAUCelBAvlIT0elnnGfMxCBOaMv8WtroDjBnse7yfnKh6yND97jot32wdgOJUrq37/z6fjKjD9dKiRj/Y01Js4BPK7sJzIDqbkT3cASaJ7tb5UY8fYaJLbFyW5yglhiNTr5XTs9/itaKmDR4elAgC"},
  {"familyName":"Rutto","profileTarget":"tbXSK7e39Sb3U3yPi7UDjpzbOeXQnBbtdj7NGgkWz4PfLU9vIZMkpUofQHqMSWb/NZvRB0WV0bORZ1G3qKy7D5H/CJvzIgcsflLSbPWIqHJidKkQnoZ2GOEnkQA8gsrjLMEv0R232hk75/ZkVAc0KFxPKqdvzryiM2e2JZKtN8c="},
  {"familyName":"SayOley","profileTarget":"tbXSK7e39Sb3U3yPi7UDjreMLJ6vQun58YhoKe/RmcLbXHL/w+sWKsBDa9ReWpOrKbLtCJAKTyLK9pCPuuf5F+zr+k3QjW8HRtTDBgml2mXTmKklAu7UAz9PjJSOO8jgWWeUaKsijIrn3UlsVC9mAr1Sw8azr5xTMAh7hDIm3ic="},
  {"familyName":"Scarif","profileTarget":"tbXSK7e39Sb3U3yPi7UDjoqwmH9eorgJRysVGSG+fhHyiK4W44E8LiAyg+MJ2dMxnclJKeSNLMkmfR2aCKkXNpnoaREXi0YvqAJLBSkKs9giv65CCc4iCTg8sTVUK2+VU4rcw16ZsOd15GYRKEsNutwm50ApGRGwujhomcOaAiA="},
  {"familyName":"Schlitzohr","profileTarget":"tbXSK7e39Sb3U3yPi7UDjs6ATheVYfrgBaueZcvSaWCdYjVwDt3DsMGWQzq0pjCh98A8eAcPo4aGxY1lJYb+a82dtyVmXE3sTGht0oAVRLbSi1YoAvz8YBuAfCGwCVKPYYLH0nE0vP257mPaU1V4oIcKHYTpSEk6ESmmqJh1oTj5qINYtuWwLm1kYefVtLSf"},
  {"familyName":"Schrott","profileTarget":"tbXSK7e39Sb3U3yPi7UDjpjNCMttP4ZhtE/mfKjQshKKlBZydI5jmtIiwIthLDS0o68rJAdfiRvnorsvd836P5xAwO584t44pW7f8xlbHSvC/At8ejTgxtQ71cQjOOdMLmDdEMxwARbkbwNTrwqmpdWI/eGJ9ZnpLtfz/K19qgs="},
  {"familyName":"Serendia","profileTarget":"tbXSK7e39Sb3U3yPi7UDjtheSdOclYEFQW9jP0VawSC/RkV/mr00tNG+jji7L081s16EHwcREU/9exiEUsg9f6qEORdZsA0DLPXV5gQaaEG5QlUYSAYPlO+wH1zU1BEjPcLU0bSsW91hU1F/FYJhv8vwX6nmdIddt4AdZX9P/VwsCiJBq8zAZ4hfNLv7vm+g"},
  {"familyName":"Shadownest","profileTarget":"tbXSK7e39Sb3U3yPi7UDjtP1Cxq1wNR3UjnEQjhAd1OudZQ2PWAkoiWAl+aT+mq2flflWU0uKayqvx5cW2wXKUDtLsmHxOMYMX3thTxJ6vyF7RuI+sf5RKu4J5z40Yf8tt9mkzGCVhwRpoGjgpvALmiXee/kAN+U62Xw5GXOLyjTxT4ZZW9kz3y9PyxV/gom"},
  {"familyName":"SirFlameAlot","profileTarget":"tbXSK7e39Sb3U3yPi7UDjtMYn+iVs8YHBouFutb760jwOgchU2pbj++kLMHvnQH9Gn+5K6/gGVWLB6KiDaZY30/hntVyaiYCuhVUekuuZYR2nHLHa8Vbaan0cEHM/Gn7GYDhHPNazfbLfDuIkANHkiX4/fU/o31glyp9gbm8yJnLmDD6ZEwTqn4k1CWZ7M9s"},
  {"familyName":"Skooti","profileTarget":"tbXSK7e39Sb3U3yPi7UDjgyF3C48yV6vRTH6QATbXJeme/OMUPaqT8dz5ogq57+/Zw1vW4jjDOhF6ca1pqSmSPZii+NzyXW9ahX4xepTH0qHGI4gKhGEqj4BOpKbSCr13d02RIct4IU8JioEvxLbmQj24mvzsHBeJpa3XcIGg9I="},
  {"familyName":"Slubby","profileTarget":"tbXSK7e39Sb3U3yPi7UDjr6ZmIvrL14xcgXsOfhYHdZvbPP4KBhZqrvbyRuCf5zD3Vv1redQPlPet7r93Z/oGy6Ef+89McOoQsbcyflKg9vtV96AwTMbjBg69u33Dpuoh5VKzusgC33V7xqBdiVZffU/qasC99Rmvlmk83KAeK4="},
  {"familyName":"Smoxxi","profileTarget":"tbXSK7e39Sb3U3yPi7UDjive2Jo4MlqaWziMZHhtRAw8XgDmb0Ci5AHZyZLX2UViauZUeSZkQp/CSaT1Q6KFPqBovzG3AG3NNFOcG/qLv39wj5lppeT6Knx2iuKQl+U4h2YjhJDqRolYhgki8XlZ6PMcGaGkWArqZyBAB/HrFTo="},
  {"familyName":"Socka","profileTarget":"tbXSK7e39Sb3U3yPi7UDjvbhAQJPhIxXBjAbaL7kOtApqSYyff4TvwwoCPE6oaIXJs69h3SQ8IS05CsRyNUCZ6Nq+vWk6fy+3sJeio4IhlHeFceSu+aUwRQnsqyUtiiz8qddOylVY7CSA8pVh3Gm+Cd8lgiqlEbcyXnATrzfCh0="},
  {"familyName":"SpaceAnimal","profileTarget":"tbXSK7e39Sb3U3yPi7UDjgaOERvTFzKavkt1SOJnmfNZV2qLsdIiJuEA+caAq4G3q0uyZ5w1ZqsQt8PPELNuTeiMU5zXMX8BVOckgAXuno+x0sSMNwwdsrJIJna8OM2upFdliueAbKgPR5I6bACQDSKqQRNuHW4QAD301xXfmNakiOfILvEFxZMvHCK2V3/1"},
  {"familyName":"SpaceCobra","profileTarget":"tbXSK7e39Sb3U3yPi7UDjoHS10grQJwykUMzQK/sMk9LP2S8cMGzJRU49c8jZICDqnzcYSSYTrEHxuN07eh5vOAyq+ySrLM7Fkyu21hw7hQOiwknA7TdhO32nJt//HuOJMtoR5awsFgMB+Ofobl3QQZYm0EG512QEzP2xgu3cZ375N9cAOSy5STHleXjHd5g"},
  {"familyName":"Squiggz","profileTarget":"tbXSK7e39Sb3U3yPi7UDjqhq6Xl9+mPF2cDgiqFGuqp5ViGIioeGNfOZ1rsi+nQfYTOs5QXVL3ESEhLRgFUFd7hDaeR5JCUPacc0kSKSG1rZktFaj/v1aQ60zH7TNM+cf5pvP8tiTVBaRZScXG2tVSLk9QdGP48IAQUU1Uyqq20="},
  {"familyName":"Stonethrower","profileTarget":"tbXSK7e39Sb3U3yPi7UDjtlU88oDSwNvAdRfpkrPd6UnvqVJmleduaWEbiV4NQsDLPq1Kvxze6pWF7NSbZ1/LQbJ6f0h9XGTuo4G98JpXQm7I0xkM19hs6LieChYDjlTqC34ku1ZncorGCT67qmSLG93GUfvnryaCNTuw3sNQVLD0UVe8qhhiCQca/iNAUFE"},
  {"familyName":"StringOfHearts","profileTarget":"tbXSK7e39Sb3U3yPi7UDjomXUbuX/l8iMqtODBNT8kCyzL8YP+IIqwx3BBr6HQTkb5J/XX17PoZ2Yl4aWM44eeTVfNmXb87qoDSh3fMphJczO3F+Igo3NVhwruQaXbtlwFeIP0noavooHrFjWBlap8XKJsL4xWVboGBazUZGeuNSVF006Th4QuWnV5XTjL14"},
  {"familyName":"Sucrelune","profileTarget":"tbXSK7e39Sb3U3yPi7UDjvrQIwY7NP/X0VfYlQZ4+LKKJv+/SDOWXkNnCy3l08Yvp5AHFKqRI9NGgtqNQ+IB2t9vI80JrH6/9RmM19QC3+p4qnebKtHN6Uub4Z0rFZ8dCEvcmCOrv/5UNcoCH2gdnmoeFkfzF4jaDafhqlnqOSAUJg2Gma1oRls4o/IPEutC"},
  {"familyName":"Syvarriss","profileTarget":"tbXSK7e39Sb3U3yPi7UDjlECfoOCkYooZ6vVCQeDVayz2xZ/TgTdJWiAvA9De0oOBa7FwUiFFCj6owgkLVl45FidO49wp2wl5JCZ7w6ukGSBg1gjwRGy5v1srpMEGwXH3YAvIAVYsMO2X4XvLoyft0f6RXtdjya/yZwNt287HZbPBOEj0RW5Gs3mQX3v+xx9"},
  {"familyName":"ThePiterroles","profileTarget":"tbXSK7e39Sb3U3yPi7UDjsOpTGG66M71D1l78y7dC1I2gjIdRIgGjjZMt8xQimJeJdTlTD6KUv3X1RExHuQYgABWauGMaepl9+i6AtQSqFNl2lPD9lw1J2LZYLrpJupj8ZveLasNmr6RFRSRn8T2LPTG0vEuzWdWaXnjWBXb5W7lBe9P/P7ewfBY6TRRlJYB"},
  {"familyName":"Toxicdoom","profileTarget":"tbXSK7e39Sb3U3yPi7UDjgFHVj62VTjf6JpJHJhztrj1HHhDUfVl1bTutayt4NIdNKqtcwj8SrOCuzz9f6v08ec2DNRZ4SBS4VwHUGQGx3saMEaLgwAozOpSr0JFs67KbliMmY4ph3V22EWZsGjS/x721QHFWLjeL6L/WxXrnocGlWjIqe1OG4wGnhHMMXY3"},
  {"familyName":"TriggerxHappy","profileTarget":"tbXSK7e39Sb3U3yPi7UDjhCDEwWOVgVyf1hrSz9MFrwMXmdNhI2otgp9iz8Q9JtlL8EnP5QpDId1a7ou2rehpKxCO9MwU3fCYJVWtjMSJfXNkNj64Gdzk8yLmMzFl7DWOS4NSsyuLG8TcK049UBkOkceElKoTQJQSG/NUGDvKZj1I/9wXckCBmRPWlKJoZQZ"},
  {"familyName":"TurboTrym","profileTarget":"tbXSK7e39Sb3U3yPi7UDjvaouZ1VuXOEEHf10aRlNV6uFi7D8qqkwABm12BzDYDZiVdXdKIpOUh8A6//uXPmb8FcxnpSd8WyhDQuwTEXrtuGQF2n0MesyeMcTQwkFf2P1uI+eQN2TAIGIy0wda7907sENMWOiUvV5OEicYKFztpLWHPdVdT2OLaJz8hiz2gO"},
  {"familyName":"Vermiculite","profileTarget":"tbXSK7e39Sb3U3yPi7UDjtRdbBIZygFLRFgO0F7D7nBaHX5QiPODawW9u3fO+9fZTkjL2NTrK4749UKs6DJXW33gjVT+IdZbQiyBp6dh0kX9Ha7GLZkC7jpDY4wcc9N/diOsZuRcmOmfeYd/yVbZByNqismw0RPbrzx33Dpefh+qCgRGrFa9CVJcTkQ1Vjdg"},
  {"familyName":"Vokore","profileTarget":"tbXSK7e39Sb3U3yPi7UDjkKmWSKGMtz2VMIWqvLz1vXjmfXhHT7IH0e+tKSmWP7x5YyuWIUrVUSQJHvJfNBFr++ipvuXjD6hIrR/48fpIBRMsZzXzflJ1HX9+gRVqqO9WncpgU6xYJn3tCNbDLt/kyWdBDI03sabHJTZQLG0aWU="},
  {"familyName":"WhiteEaglePact","profileTarget":"tbXSK7e39Sb3U3yPi7UDjhvD6Df5ippUgAM74kbFhnynqabaKZ4qwVW7orswponbcpwvQaIelQP3CvG1mtZl3dlGQewQRYcLjxmcPmAUmYmhXns/BB5FoGcu6oaRBJc83y8fOAiPqFzt4ZN8+V3pgdKdsMJWJW7CsR2XYTqud8o8EnJfuPwzwcx59lzzyAlw"},
  {"familyName":"XKeluX","profileTarget":"tbXSK7e39Sb3U3yPi7UDjrimCdMSrfXKJR/PjBOhG3VeglipXLVKVt4SUAggLAlOpFtgHOAiMMlVuA/PE5hN5YZz6IJwiLS44EGuBXtYR0furdrLNgVlFeaxTyyp5/MxjggQkFXj8H8OUDyl/jC5XqLZ5HLFam+cn4tj3PjJn4s="},
  {"familyName":"Xyreses","profileTarget":"tbXSK7e39Sb3U3yPi7UDjm5VnjvqgnE28L2bdF+cs7m7jO1mMa4VHhQaOhwhKlgrs/rXKZ09NDZgptbroak5DpIFR0ahuuMFSsY2E0IPSxtvfjYBH4QUx6rW4Zfspq9LhGp9MtbruKRy6181oS6Xv1pNmjszuzuEHxn6S3hW/tQ="},
  {"familyName":"Yen","profileTarget":"tbXSK7e39Sb3U3yPi7UDjiKzqkhi/UQ1KWbwszGy81+hm7vckgQnP2aJhZ2HY23ZGxJevCp1RROzMJGyTOmeqqJGAmbDPTjhQZ92TMuOfiv/tpnaq1G/8hpguM36Jb+iuEJwPjXt+V1Crf8WPyn8L2QuWvkyiHx/LCvNKiZXHis="},
  {"familyName":"Yosueh","profileTarget":"tbXSK7e39Sb3U3yPi7UDjlrmcQZH+o0IWDnOhT4W8RnX+Xa88XrkWA+jIKKB8+vaCtwkSPJVICbRc/vDZ/Cmk7kObTjAZ2sEEC1NEnlCDJARuRhGvchuNvqsxDz2GsiJPkk8jDxX2OceDidwRu9BTYlIYi3fukFI/5sCmzqdbqM="}
];

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fetchWithRetry(url, params, retries = 12, delay = 8000) {
  for (let i = 0; i < retries; i++) {
    const res = await axios.get(url, { params, timeout: 30000 });
    if (res.data?.status === 'started' || res.data?.status === 'pending') {
      console.log(`  polling ${i + 1}/${retries}...`);
      await sleep(delay);
      continue;
    }
    return res.data;
  }
  throw new Error(`No result after ${retries} attempts`);
}

async function main() {
  if (!ADMIN_TOKEN) throw new Error('ADMIN_TOKEN not set');
  const targetDate = TARGET_DATE || new Date(Date.now() - 86400000).toISOString().split('T')[0];
  console.log(`Target date: ${targetDate}`);
  console.log(`${MEMBERS.length} members (${MEMBERS.filter(m => m.profileTarget).length} with profileTarget)`);

  console.log('Waiting 8s for bdo-api...');
  await sleep(8000);

  const snapshots = [];
  const failed = [];

  for (const member of MEMBERS) {
    if (!member.profileTarget) {
      console.log(`⚠ ${member.familyName}: no profileTarget — skipped`);
      failed.push(member.familyName);
      continue;
    }
    try {
      const profile = await fetchWithRetry(`${BDO_API}/v1/adventurer`, {
        profileTarget: member.profileTarget, region: REGION
      });
      const spec = profile.specLevels || {};
      const row = {
        family_name:         profile.familyName || member.familyName,
        life_fame:           profile.lifeFame || 0,
        contribution_points: profile.contributionPoints || 0,
        energy:              profile.energy || 0,
      };
      for (const skill of LIFESKILLS) row[`spec_${skill}`] = spec[skill] || '';
      snapshots.push(row);
      console.log(`✓ ${row.family_name}`);
      await sleep(5000);
    } catch (e) {
      console.error(`✗ ${member.familyName}: ${e.message}`);
      failed.push(member.familyName);
    }
  }

  if (snapshots.length === 0) throw new Error('No data collected');

  console.log(`\nSending ${snapshots.length}/${MEMBERS.length} snapshots for ${targetDate}...`);
  const res = await axios.post(
    `${SERVER_URL}/api/admin/bulk-snapshot`,
    { date: targetDate, snapshots, failed },
    { headers: { 'x-admin-token': ADMIN_TOKEN }, timeout: 30000 }
  );
  console.log(`✅ ${res.data.saved} snapshots saved for ${targetDate}`);

  if (failed.length > 0)
    console.log(`⚠️  Failed (${failed.length}): ${failed.join(', ')}`);
}

main().catch(e => {
  console.error('Critical error:', e.message);
  process.exit(1);
});
