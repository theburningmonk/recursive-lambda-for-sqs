'use strict';

const AWS = require('aws-sdk');
const SQS = new AWS.SQS({ apiVersion: '2012-11-05' });
const Lambda = new AWS.Lambda({ apiVersion: '2015-03-31' });

// these come from s-function.json.environment vars 
const queueUrl = process.env.QUEUE_URL;
const funcName = process.env.FUNC_NAME;

function sayHello (msg) {
  console.log(`Hello, ${msg.Body} of message ID [${msg.MessageId}]`);
  let delParams = {
    QueueUrl: queueUrl,
    ReceiptHandle: msg.ReceiptHandle
  };
  
  return SQS
    .deleteMessage(delParams)
    .promise()
    .then(() => console.log(`Message ID [${msg.MessageId}] deleted`))
    .catch(err => console.log(`Message ID [${msg.MessageId}]`, err, err.stack));
}

function recurse () {
  let params = { 
    FunctionName: funcName,
    InvokeArgs: "{}"
  };
    
  return Lambda
    .invokeAsync(params)
    .promise()
    .then((data) => console.log("Recursed."));
}

module.exports.handler = function(event, context) {
  let params = {
    QueueUrl            : queueUrl,
    MaxNumberOfMessages : 10,
    VisibilityTimeout   : 6,
    WaitTimeSeconds     : 20
  };
  
  SQS
    .receiveMessage(params)
    .promise()
    .then(res => {
      if (res.Messages) {
        return Promise.all(res.Messages.map(sayHello));
      }
    })
    // handle any errors and restore the chain so we always get
    // to the next step - which is to recurse
    .catch(err => console.log(err, err.stack))
    .then(() => recurse())
    .then(() => context.succeed())
    // only fail the function if we couldn't recurse, which we
    // can then monitor via CloudWatch and trigger 
    .catch(err => context.fail(err, err.stack));
};