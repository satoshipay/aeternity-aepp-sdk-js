/*
 * ISC License (ISC)
 * Copyright 2018 aeternity developers
 *
 *  Permission to use, copy, modify, and/or distribute this software for any
 *  purpose with or without fee is hereby granted, provided that the above
 *  copyright notice and this permission notice appear in all copies.
 *
 *  THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
 *  REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
 *  AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
 *  INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
 *  LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
 *  OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
 *  PERFORMANCE OF THIS SOFTWARE.
 */

import Ae from '../../es/ae/universal'
import * as Crypto from '../../es/utils/crypto'
import { BigNumber } from 'bignumber.js'

const url = process.env.TEST_URL || 'http://localhost:3013'
const internalUrl = process.env.TEST_INTERNAL_URL || 'http://localhost:3113'
const compilerUrl = process.env.COMPILER_URL || 'http://localhost:3080'
const networkId = process.env.TEST_NETWORK_ID || 'ae_devnet'
const account = Crypto.generateKeyPair()

const BaseAe = (params) => Ae.compose({
  deepProps: { Swagger: { defaults: { debug: !!process.env['DEBUG'] } } },
  props: { url, internalUrl, process, compilerUrl }
})({ ...params })

let planned = BigNumber(0)
let charged = false

function plan (amount) {
  planned = planned.plus(amount)
}

const TIMEOUT = 18000000

function configure (mocha) {
  mocha.timeout(TIMEOUT)
}

async function ready (mocha, native = true) {
  configure(mocha)

  const ae = await BaseAe({ networkId })
  await ae.awaitHeight(2)

  if (!charged && planned > 0) {
    console.log(`Charging new wallet ${account.publicKey} with ${planned}`)
    await ae.spend(planned.toString(10), account.publicKey)
    charged = true
  }

  const client = await BaseAe({ nativeMode: native, networkId })
  client.setKeypair(account)
  return client
}

export {
  BaseAe,
  url,
  internalUrl,
  networkId,
  configure,
  ready,
  plan
}
