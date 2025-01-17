/*
 * ISC License (ISC)
 * Copyright (c) 2018 aeternity developers
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

import { describe, it, before } from 'mocha'
import { configure, plan, ready } from './'
import { decode } from '../../es/tx/builder/helpers'
import * as R from 'ramda'

const identityContract = `
contract Identity =
  type state = ()
  function main(x : int) = x
`
const stateContract = `
contract StateContract =
  record state = { value: string }
  public function init(value) : state = { value = value }
  public function retrieve() : string = state.value
`
const testContract = `
contract Voting =
  public function test() : int = 1

contract StateContract =
  type number = int
  record state = { value: string, key: number, testOption: option(string) }
  record yesEr = { t: number}
  
  public function init(value: string, key: int, testOption: option(string)) : state = { value = value, key = key, testOption = testOption }
  public function retrieve() : (string, int) = (state.value, state.key)

  public function intFn(a: int) : int = a
  public function stringFn(a: string) : string = a
  public function boolFn(a: bool) : bool = a
  public function addressFn(a: address) : address = a
  public function contractAddress (ct: address) : address = ct
  public function accountAddress (ak: address) : address = ak

  public function tupleFn (a: (string, int)) : (string, int) = a
  public function tupleInTupleFn (a: ((string, string), int)) : ((string, string), int) = a
  public function tupleWithList (a: (list(int), int)) : (list(int), int) = a
  
  public function listFn(a: list(int)) : list(int) = a
  public function listInListFn(a: list(list(int))) : list(list(int)) = a
  
  public function mapFn(a: map(address, (string, int))) : map(address, (string, int)) = a
  public function mapOptionFn(a: map(address, (string, option(int)))) : map(address, (string, option(int))) = a
  
  public function getRecord() : state = state
  public stateful function setRecord(s: state) = put(s)
  
  public function intOption(s: option(int)) : option(int) = s
  public function listOption(s: option(list((int, string)))) : option(list((int ,string))) = s
  
  public function testFn(a: list(int), b: bool) : (list(int), bool) = (a, b)
  public function approve(tx_id: int, voting_contract: Voting) : int = tx_id
  
  public function hashFn(s: hash): hash = s
  public function signatureFn(s: signature): signature = s
  public function bytesFn(s: bytes(32)): bytes(32) = s
`

const encodedNumberSix = 'cb_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAaKNdnK'

plan('1000000000000000000000')

describe('Contract', function () {
  configure(this)

  let contract
  let bytecode
  let deployed

  before(async function () {
    contract = await ready(this)
  })

  it('precompiled bytecode can be deployed', async () => {
    const code = await contract.contractCompile(identityContract)
    return contract.contractDeploy(code.bytecode, identityContract).should.eventually.have.property('address')
  })

  it('compiles Sophia code', async () => {
    bytecode = await contract.contractCompile(identityContract)
    return bytecode.should.have.property('bytecode')
  })

  it('deploys compiled contracts', async () => {
    deployed = await bytecode.deploy()
    return deployed.should.have.property('address')
  })

  it('calls deployed contracts', async () => {
    const result = await deployed.call('main', ['42'])
    return result.decode().should.eventually.become(42)
  })

  it('calls deployed contracts static', async () => {
    const result = await deployed.callStatic('main', ['42'])
    return result.decode().should.eventually.become(42)
  })

  it('initializes contract state', async () => {
    const data = `"Hello World!"`
    return contract.contractCompile(stateContract)
      .then(bytecode => bytecode.deploy([data]))
      .then(deployed => deployed.call('retrieve'))
      .then(result => result.decode())
      .catch(e => {
        console.log(e)
        throw e
      })
      .should.eventually.become('Hello World!')
  })

  describe('Sophia Compiler', function () {
    it('compile', async () => {
      const code = await contract.compileContractAPI(identityContract)
      const prefix = code.slice(0, 2)
      const isString = typeof code === 'string'
      prefix.should.be.equal('cb')
      isString.should.be.equal(true)
    })
    it('get contract ACI', async () => {
      const aci = await contract.contractGetACI(identityContract)
      aci.should.have.property('interface')
    })
    it('encode call-data', async () => {
      const encoded = await contract.contractEncodeCallDataAPI(identityContract, 'init', [])
      const prefix = encoded.slice(0, 2)
      const isString = typeof encoded === 'string'
      prefix.should.be.equal('cb')
      isString.should.be.equal(true)
    })
    it('decode call-data', async () => {
      return contract.contractDecodeCallResultAPI(identityContract, 'main', encodedNumberSix, 'ok').should.eventually.become(6)
    })
  })

  describe('Contract ACI Interface', function () {
    let contractObject

    it('Generate ACI object', async () => {
      contractObject = await contract.getContractInstance(testContract, { opt: { amount: 10000, ttl: 10 } })
      contractObject.should.have.property('interface')
      contractObject.should.have.property('aci')
      contractObject.should.have.property('source')
      contractObject.should.have.property('compiled')
      contractObject.should.have.property('deployInfo')
      contractObject.should.have.property('compile')
      contractObject.should.have.property('call')
      contractObject.should.have.property('deploy')
      contractObject.options.amount.should.be.equal(10000)
      const functionsFromACI = contractObject.aci.functions.map(({ name }) => name)
      const methods = Object.keys(contractObject.methods)
      R.equals(methods, functionsFromACI).should.be.equal(true)
    })
    it('Compile contract', async () => {
      await contractObject.compile()
      const isCompiled = contractObject.compiled.length && contractObject.compiled.slice(0, 3) === 'cb_'
      isCompiled.should.be.equal(true)
    })

    describe('Deploy contract', function () {
      it('Deploy contract before compile', async () => {
        contractObject.compiled = null
        await contractObject.methods.init('123', 1, Promise.resolve('hahahaha'))
        const isCompiled = contractObject.compiled.length && contractObject.compiled.slice(0, 3) === 'cb_'
        isCompiled.should.be.equal(true)
      })
    })
    describe('Arguments Validation and Casting', function () {
      describe('INT', function () {
        it('Invalid', async () => {
          try {
            await contractObject.methods.intFn('asd')
          } catch (e) {
            e.message.should.be.equal('"Argument" at position 0 fails because [Value "[asd]" at path: [0] not a number]')
          }
        })
        it('Valid', async () => {
          const { decodedResult } = await contractObject.methods.intFn(1)
          decodedResult.toString().should.be.equal('1')
        })
      })
      describe('STRING', function () {
        it('Invalid', async () => {
          try {
            await contractObject.methods.stringFn(123)
          } catch (e) {
            e.message.should.be.equal('"Argument" at position 0 fails because [Value "123" at path: [0] not a string]')
          }
        })
        it('Valid', async () => {
          const { decodedResult } = await contractObject.methods.stringFn('string')
          decodedResult.should.be.equal('string')
        })
      })
      describe('ADDRESS', function () {
        it('Invalid address', async () => {
          try {
            await contractObject.methods.addressFn('asdasasd')
          } catch (e) {
            e.message.should.be.equal('"Argument" at position 0 fails because ["[asdasasd]" with value "asdasasd" fails to match the required pattern: /^(ak_|ct_|ok_|oq_)/]')
          }
        })
        it('Invalid address type', async () => {
          try {
            await contractObject.methods.addressFn(333)
          } catch (e) {
            e.message.should.be.equal('"Argument" at position 0 fails because [Value "333" at path: [0] not a string]')
          }
        })
        it('Return address', async () => {
          const { decodedResult } = await contractObject.methods.accountAddress(await contract.address())
          decodedResult.should.be.equal(await contract.address())
        })
        it('Valid', async () => {
          const { decodedResult } = await contractObject.methods.addressFn('ak_2ct6nMwmRnyGX6jPhraFPedZ5bYp1GXqpvnAq5LXeL5TTPfFif')
          decodedResult.should.be.equal('ak_2ct6nMwmRnyGX6jPhraFPedZ5bYp1GXqpvnAq5LXeL5TTPfFif')
        })
      })
      describe('TUPLE', function () {
        it('Invalid type', async () => {
          try {
            await contractObject.methods.tupleFn('asdasasd')
          } catch (e) {
            e.message.should.be.equal('"Argument" at position 0 fails because [Value "[asdasasd]" at path: [0] not a array]')
          }
        })
        it('Invalid tuple prop type', async () => {
          try {
            await contractObject.methods.tupleFn([1, 'string'])
          } catch (e) {
            e.message.should.be.equal('"Argument" at position 0 fails because ["[1,string]" at position 0 fails because [Value "1" at path: [0,0] not a string], "[1,string]" at position 1 fails because [Value "1" at path: [0,1] not a number]]')
          }
        })
        it('Required tuple prop', async () => {
          try {
            await contractObject.methods.tupleFn([1])
          } catch (e) {
            e.message.should.be.equal('"Argument" at position 0 fails because ["[1]" at position 0 fails because [Value "1" at path: [0,0] not a string], "[1]" does not contain 1 required value(s)]')
          }
        })
        it('Wrong type in list inside tuple', async () => {
          try {
            await contractObject.methods.tupleWithList([[true], 1])
          } catch (e) {
            e.message.should.be.equal('"Argument" at position 0 fails because ["[true,1]" at position 0 fails because ["0" at position 0 fails because [Value "0" at path: [0,0,0] not a number]]]')
          }
        })
        it('Wrong type in tuple inside tuple', async () => {
          try {
            await contractObject.methods.tupleInTupleFn([['str', 1], 1])
          } catch (e) {
            e.message.should.be.equal('"Argument" at position 0 fails because ["[str,1,1]" at position 0 fails because ["Tuple argument" at position 1 fails because [Value "1" at path: [0,0,1] not a string]]]')
          }
        })
        it('Valid', async () => {
          const { decodedResult } = await contractObject.methods.tupleFn(['test', 1])
          JSON.stringify(decodedResult).should.be.equal(JSON.stringify(['test', 1]))
        })
      })
      describe('LIST', function () {
        it('Invalid type', async () => {
          try {
            await contractObject.methods.listFn('asdasasd')
          } catch (e) {
            e.message.should.be.equal('"Argument" at position 0 fails because [Value "[asdasasd]" at path: [0] not a array]')
          }
        })
        it('Invalid list element type', async () => {
          try {
            await contractObject.methods.listFn([1, 'string'])
          } catch (e) {
            e.message.should.be.equal('"Argument" at position 0 fails because ["[1,string]" at position 1 fails because [Value "1" at path: [0,1] not a number]]')
          }
        })
        it('Invalid list element type nested', async () => {
          try {
            await contractObject.methods.listInListFn([['childListWronmgElement'], 'parentListWrongElement'])
          } catch (e) {
            e.message.should.be.equal('"Argument" at position 0 fails because ["[childListWronmgElement,parentListWrongElement]" at position 0 fails because ["0" at position 0 fails because [Value "0" at path: [0,0,0] not a number]], "[childListWronmgElement,parentListWrongElement]" at position 1 fails because [Value "1" at path: [0,1] not a array]]')
          }
        })
        it('Valid', async () => {
          const { decodedResult } = await contractObject.methods.listInListFn([[1, 2], [3, 4]])
          JSON.stringify(decodedResult).should.be.equal(JSON.stringify([[1, 2], [3, 4]]))
        })
      })
      describe('MAP', function () {
        it('Valid', async () => {
          const address = await contract.address()
          const mapArg = new Map(
            [
              [address, ['someStringV', 324]]
            ]
          )
          const { decodedResult } = await contractObject.methods.mapFn(mapArg)
          JSON.stringify(decodedResult).should.be.equal(JSON.stringify(Array.from(mapArg.entries())))
        })
        it('Map With Option Value', async () => {
          const address = await contract.address()
          let mapArgWithSomeValue = new Map(
            [
              [address, ['someStringV', Promise.resolve(123)]]
            ]
          )
          let mapArgWithNoneValue = new Map(
            [
              [address, ['someStringV', Promise.reject(Error()).catch(e => undefined)]]
            ]
          )
          let returnArgWithSomeValue = new Map(
            [
              [address, ['someStringV', 123]]
            ]
          )
          let returnArgWithNoneValue = new Map(
            [
              [address, ['someStringV', undefined]]
            ]
          )
          const resultWithSome = await contractObject.methods.mapOptionFn(mapArgWithSomeValue)
          const resultWithNone = await contractObject.methods.mapOptionFn(mapArgWithNoneValue)

          const decodedSome = resultWithSome.decodedResult

          JSON.stringify(decodedSome).should.be.equal(JSON.stringify(Array.from(returnArgWithSomeValue.entries())))
          JSON.stringify(resultWithNone.decodedResult).should.be.equal(JSON.stringify(Array.from(returnArgWithNoneValue.entries())))
        })
        it('Cast from string to int', async () => {
          const address = await contract.address()
          const mapArg = new Map(
            [
              [address, ['someStringV', '324']]
            ]
          )
          const result = await contractObject.methods.mapFn(mapArg)
          mapArg.set(address, ['someStringV', 324])
          JSON.stringify(result.decodedResult).should.be.equal(JSON.stringify(Array.from(mapArg.entries())))
        })
        it('Cast from array to map', async () => {
          const address = await contract.address()
          const mapArg =
            [
              [address, ['someStringV', 324]]
            ]
          const { decodedResult } = await contractObject.methods.mapFn(mapArg)
          JSON.stringify(decodedResult).should.be.equal(JSON.stringify(mapArg))
        })
      })
      describe('RECORD/STATE', function () {
        const objEq = (obj, obj2) => !Object.entries(obj).find(([key, val]) => JSON.stringify(obj2[key]) !== JSON.stringify(val))
        it('Valid Set Record (Cast from JS object)', async () => {
          await contractObject.methods.setRecord({ value: 'qwe', key: 1234, testOption: Promise.resolve('test') })
          const state = await contractObject.methods.getRecord()

          objEq(state.decodedResult, { value: 'qwe', key: 1234, testOption: 'test' }).should.be.equal(true)
        })
        it('Get Record(Convert to JS object)', async () => {
          const result = await contractObject.methods.getRecord()
          objEq(result.decodedResult, { value: 'qwe', key: 1234, testOption: 'test' }).should.be.equal(true)
        })
        it('Get Record With Option (Convert to JS object)', async () => {
          await contractObject.methods.setRecord({ key: 1234, value: 'qwe', testOption: Promise.resolve('resolved string') })
          const result = await contractObject.methods.getRecord()
          objEq(result.decodedResult, { value: 'qwe', key: 1234, testOption: 'resolved string' }).should.be.equal(true)
        })
        it('Invalid value type', async () => {
          try {
            await contractObject.methods.setRecord({ value: 123, key: 'test' })
          } catch (e) {
            e.message.should.be.equal('"Argument" at position 0 fails because [child "value" fails because [Value "123" at path: [0,value] not a string], child "key" fails because [Value "key" at path: [0,key] not a number]]')
          }
        })
      })
      describe('OPTION', function () {
        it('Set Some Option Value(Cast from JS value/Convert result to JS)', async () => {
          const optionRes = await contractObject.methods.intOption(Promise.resolve(123))

          optionRes.decodedResult.should.be.equal(123)
        })
        it('Set Some Option List Value(Cast from JS value/Convert result to JS)', async () => {
          const optionRes = await contractObject.methods.listOption(Promise.resolve([[1, 'testString']]))

          JSON.stringify(optionRes.decodedResult).should.be.equal(JSON.stringify([[1, 'testString']]))
        })
        it('Set None Option Value(Cast from JS value/Convert to JS)', async () => {
          const optionRes = await contractObject.methods.intOption(Promise.reject(Error()))
          const isUndefined = optionRes.decodedResult === undefined
          isUndefined.should.be.equal(true)
        })
        it('Invalid option type', async () => {
          try {
            await contractObject.methods.intOption({ s: 2 })
          } catch (e) {
            e.message.should.be.equal('"Argument" at position 0 fails because [Value \'[[object Object]]\' at path: [0] not a Promise]')
          }
        })
      })
      describe('Hash', function () {
        it('Invalid type', async () => {
          try {
            await contractObject.methods.hashFn({})
          } catch (e) {
            e.message.should.be.equal('The first argument must be one of type string, Buffer, ArrayBuffer, Array, or Array-like Object. Received type object')
          }
        })
        it('Invalid length', async () => {
          const address = await contract.address()
          const decoded = Buffer.from(decode(address, 'ak').slice(1))
          try {
            await contractObject.methods.hashFn(decoded)
          } catch (e) {
            const isSizeCheck = e.message.indexOf('not a 32 bytes') !== -1
            isSizeCheck.should.be.equal(true)
          }
        })
        it('Valid', async () => {
          const address = await contract.address()
          const decoded = decode(address, 'ak')
          const hashAsBuffer = await contractObject.methods.hashFn(decoded)
          const hashAsHex = await contractObject.methods.hashFn(decoded.toString('hex'))
          hashAsBuffer.decodedResult.should.be.equal(decoded.toString('hex'))
          hashAsHex.decodedResult.should.be.equal(decoded.toString('hex'))
        })
      })
      describe('Signature', function () {
        it('Invalid type', async () => {
          try {
            await contractObject.methods.signatureFn({})
          } catch (e) {
            e.message.should.be.equal('The first argument must be one of type string, Buffer, ArrayBuffer, Array, or Array-like Object. Received type object')
          }
        })
        it('Invalid length', async () => {
          const address = await contract.address()
          const decoded = decode(address, 'ak')
          try {
            await contractObject.methods.signatureFn(decoded)
          } catch (e) {
            const isSizeCheck = e.message.indexOf('not a 64 bytes') !== -1
            isSizeCheck.should.be.equal(true)
          }
        })
        it('Valid', async () => {
          const address = await contract.address()
          const decoded = decode(address, 'ak')
          const fakeSignature = Buffer.from(await contract.sign(decoded))
          const hashAsBuffer = await contractObject.methods.signatureFn(fakeSignature)
          const hashAsHex = await contractObject.methods.signatureFn(fakeSignature.toString('hex'))
          hashAsBuffer.decodedResult.should.be.equal(fakeSignature.toString('hex'))
          hashAsHex.decodedResult.should.be.equal(fakeSignature.toString('hex'))
        })
      })
      describe('Bytes', function () {
        it('Invalid type', async () => {
          try {
            await contractObject.methods.bytesFn({})
          } catch (e) {
            e.message.should.be.equal('The first argument must be one of type string, Buffer, ArrayBuffer, Array, or Array-like Object. Received type object')
          }
        })
        it('Invalid length', async () => {
          const address = await contract.address()
          const decoded = decode(address, 'ak')
          try {
            await contractObject.methods.bytesFn(Buffer.from([...decoded, 2]))
          } catch (e) {
            const isSizeCheck = e.message.indexOf('not a 32 bytes') !== -1
            isSizeCheck.should.be.equal(true)
          }
        })
        it('Valid', async () => {
          const address = await contract.address()
          const decoded = decode(address, 'ak')
          const hashAsBuffer = await contractObject.methods.bytesFn(decoded)
          const hashAsHex = await contractObject.methods.bytesFn(decoded.toString('hex'))
          hashAsBuffer.decodedResult.should.be.equal(decoded.toString('hex'))
          hashAsHex.decodedResult.should.be.equal(decoded.toString('hex'))
        })
      })
    })
    describe('Call contract', function () {
      it('Call contract using using sophia type arguments', async () => {
        contractObject.setOptions({ skipArgsConvert: true })
        const res = await contractObject.methods.listFn('[ 1, 2 ]')
        contractObject.setOptions({ skipArgsConvert: false })
        return res.decode().should.eventually.become([1, 2])
      })
      it('Call contract using using js type arguments', async () => {
        const res = await contractObject.methods.listFn([ 1, 2 ])
        return res.decode().should.eventually.become([1, 2])
      })
      it('Call contract using using js type arguments and skip result transform', async () => {
        contractObject.setOptions({ skipTransformDecoded: true })
        const res = await contractObject.methods.listFn([ 1, 2 ])
        const decoded = await res.decode()
        const decodedJSON = JSON.stringify([ 1, 2 ])
        contractObject.setOptions({ skipTransformDecoded: false })
        JSON.stringify(decoded).should.be.equal(decodedJSON)
      })
      it('Call contract with contract type argument', async () => {
        const result = await contractObject.methods.approve(0, 'ct_AUUhhVZ9de4SbeRk8ekos4vZJwMJohwW5X8KQjBMUVduUmoUh')
        return result.decode().should.eventually.become(0)
      })
    })
  })
})
