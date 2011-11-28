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

var config;

exports.configure = function (_config)
{
  config = _config;
}

exports.pipe = function (inCon, outCon)
{
  var firstPackage = true;

  this.onData = function (packet, callback)
  {
    if(firstPackage)
    {
      var loseTime = Math.floor(Math.random() * config.lose * 1000 * 2);
      
      setTimeout(function(){
        //return if booth connections are already destroyed
        if(inCon.destroyed && outCon.destroyed)
        {
          return;
        }
        
        inCon.logger.info("random disconnect after " + loseTime + " ms");
        
        inCon.destroy();
        inCon.end();
        outCon.destroy();
        outCon.end();
      }, loseTime);
      
      firstPackage = false;
    }
  
    callback(packet);
  }
}
