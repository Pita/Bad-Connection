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

var argv   = require('optimist').argv;
var net    = require('net');
var async  = require('async');

//get options
var port     = argv.port     || argv.p;
var target   = argv.target   || argv.t;
var help     = argv.help;
var delay    = argv.delay    || argv.d;
var bandwith = argv.bandwith || argv.b;
var lose     = argv.lose     || argv.l;

//show help if not enough options or help is requested
if(!port || !target || help)
{
  console.error("Use: badconnection -p PORTNUMBER -t TARGETHOST:PORT [options...]\n\n"+
                "Options:\n"+
                "-d --delay     Delay in ms\n"+
                "-b --bandwith  The bandwith of one TCP connection in both directons in kilobit/s\n"+
                "-l --lose      average time between TCP connection lose in seconds\n");
  process.exit(1);
}

/***************************/
/**Check basic config*******/
/***************************/

//try to parse the portnumber
try
{
  port = parseInt(port);
}
catch(e)
{
  console.error("Port is not a number");
  process.exit(1);
}

//check if the target argument is valid
var targetParts = target.split(":");
if(targetParts.length != 2)
{
  console.error("Target must be in scheme TARGETHOST:PORT, '" + target + "' is invalid");
  process.exit(1);
}
var targetHost = targetParts[0];
var targetPort = targetParts[1];
try
{
  targetPort = parseInt(targetPort);
}
catch(e)
{
  console.error("Target Port is not a number");
  process.exit(1);
}

/***************************/
/**Initalize Modules********/
/***************************/

var modules = [];

if(delay)
{
  try
  {
    delay = parseInt(delay);
  }
  catch(e)
  {
    console.error("Delay is not a number");
    process.exit(1);
  }

  var delayModule = require("./delay");
  delayModule.configure({"delay": delay});
  modules.push(delayModule);
}

if(bandwith)
{
  try
  {
    bandwith = parseInt(bandwith);
  }
  catch(e)
  {
    console.error("Bandwith is not a number");
    process.exit(1);
  }

  var delayModule = require("./bandwith");
  delayModule.configure({"bandwith": bandwith});
  modules.push(delayModule);
}

if(lose)
{
  try
  {
    lose = parseInt(lose);
  }
  catch(e)
  {
    console.error("Lose is not a number");
    process.exit(1);
  }

  var delayModule = require("./lose");
  delayModule.configure({"lose": lose});
  modules.push(delayModule);
}

/***************************/
/**Initalize Server*********/
/***************************/

//start logger
var log4js = require('log4js');

//init counter
var counter = 0;
var endPackage = new Buffer("!!!END!!!");

//start the server
var server = net.createServer(function(inCon) 
{ 
  //init inCon logger
  inCon.logger = log4js.getLogger("Connection #" + (counter++));
  
  //log
  inCon.logger.info("incoming connection etablished from " + inCon.remoteAddress + ":" + inCon.remotePort);

  var outCon = net.createConnection(targetPort, targetHost);
  outCon.logger = inCon.logger;
  
  //log all events 
  outCon.on('connect', function()
  {
    outCon.logger.info("outgoing connection etablished to   " + target);
  });
  outCon.on('error', function(e)
  {
    outCon.logger.error("Problem with outgoing connection: " + e.message);
    inCon.end();
  });
  inCon.on('error', function(e)
  {
    inCon.logger.error("Problem with incoming connection: " + e.message);
    outCon.end();
  });
  outCon.on('end', function(e)
  {
    outCon.logger.info("outgoing connection closed");
    //send fake package trough the pipe
    pipeDataTroughModules(endPackage, outCon, inCon);
  });
  inCon.on('end', function() {
    inCon.logger.info("incoming connection closed");
    //send fake package trough the pipe
    pipeDataTroughModules(endPackage, inCon, outCon);
  });
  
  //outCon.pipe(inCon);
  //inCon.pipe(outCon);
  
  //create an instanz of each module for this connection
  var conModules=[];
  for(var i=0;i<modules.length;i++)
  {
    conModules.push(new modules[i].pipe(inCon, outCon));
  }
  
  //pipes a packet trough all modules
  function pipeDataTroughModules(_data, sourceCon, targetCon)
  {    
    var data = _data;
    
    async.forEachSeries(conModules, function(module, callback)
    {
      module.onData(data, function(_data)
      {
        data = _data;
        callback();
      });
    }, function(err)
    {
      //if this was the endPackage, close the connection
      if(_data === endPackage)
      {
        targetCon.end();
      }
      //a normal package, pass it trough
      else
      {
        try
        {
          targetCon.write(data);
        } catch(e) 
        {
          sourceCon.logger.warn(e.message);
        }
      }
    })
  }
  
  //pipe
  outCon.on('data', function(data)
  {
    pipeDataTroughModules(data, outCon, inCon);
  });
  inCon.on('data', function(data)
  {
    pipeDataTroughModules(data, inCon, outCon);
  });
  
}).listen(port);
console.log("listening on port " + port);
