/*
 * 2011 Peter 'Pita' Martischka
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS-IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

var async = require("async");
var config;

exports.configure = function (_config)
{
  config = _config;
}

exports.pipe = function (inCon, outCon)
{
  var queue = async.queue(function (task, callback) {
    //calculate the delay of this package by its size
    var packetSizeInBit     = task.packet.length * 8;
    var bitsPerSecond       = config.bandwith*1000;
    var delayInSeconds      = packetSizeInBit/bitsPerSecond;
    var delayInMilliSeconds = Math.round(delayInSeconds*1000);
    
    setTimeout(function(){
      task.callback(task.packet);
      callback();
    }, delayInMilliSeconds);
  }, 1);

  this.onData = function (packet, callback)
  {
    queue.push({packet:packet, callback: callback});
  }
}
