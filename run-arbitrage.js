require("dotenv").config();
const Web3 = require("web3");
const abis = require("./abis");
const { mainnet: addresses } = require("./addresses");
const Flashloan = require("./build/contracts/TokenFlashSwap.json");

const web3 = new Web3(
  new Web3.providers.WebsocketProvider(process.env.WSS_URL)
);
const { address: admin } = web3.eth.accounts.wallet.add(
  process.env.PRIVATE_KEY
);
const wbnbamount = "1";
const flashloanToken1 = "10";
const flashloanToken2 = "10";
const amountInToken1 = web3.utils.toBN(web3.utils.toWei(flashloanToken1));
const amountInToken2 = web3.utils.toBN(web3.utils.toWei(flashloanToken2));

const Exchange1 = new web3.eth.Contract(
  abis.exchange1.router,
  addresses.exchange1.router
);

const Exchange2 = new web3.eth.Contract(
  abis.exchange2.router,
  addresses.exchange2.router
);

const init = async () => {
  const networkId = await web3.eth.net.getId();
  const flashloan = new web3.eth.Contract(
    Flashloan.abi,
    Flashloan.networks[networkId].address
  );

  web3.eth
    .subscribe("newBlockHeaders")
    .on("data", async (block) => {
      console.log(`New block received. Block # ${block.number}`);

      const getbnbprice = await Exchange1.methods
        .getAmountsOut(wbnbamount, [
          addresses.tokens.Wbnb,
          addresses.tokens.busd,
        ])
        .call();

      const amountsOut1 = await Exchange1.methods
        .getAmountsIn(amountInToken1, [
          addresses.tokens.Token2,
          addresses.tokens.Token1,
        ])
        .call();
      const amountsOut2 = await Exchange1.methods
        .getAmountsOut(amountInToken1, [
          addresses.tokens.Token1,
          addresses.tokens.Token2,
        ])
        .call();

      const amountsOut3 = await Exchange2.methods
        .getAmountsIn(amountInToken1, [
          addresses.tokens.Token2,
          addresses.tokens.Token1,
        ])
        .call();
      const amountsOut4 = await Exchange2.methods
        .getAmountsOut(amountInToken1, [
          addresses.tokens.Token1,
          addresses.tokens.Token2,
        ])
        .call();

      const amountsOut5 = await Exchange1.methods
        .getAmountsIn(amountInToken2, [
          addresses.tokens.Token1,
          addresses.tokens.Token2,
        ])
        .call();
      const amountsOut6 = await Exchange1.methods
        .getAmountsOut(amountInToken2, [
          addresses.tokens.Token2,
          addresses.tokens.Token1,
        ])
        .call();

      const amountsOut7 = await Exchange2.methods
        .getAmountsIn(amountInToken2, [
          addresses.tokens.Token1,
          addresses.tokens.Token2,
        ])
        .call();
      const amountsOut8 = await Exchange2.methods
        .getAmountsOut(amountInToken2, [
          addresses.tokens.Token2,
          addresses.tokens.Token1,
        ])
        .call();

      const Exchange1results = {
        buy: amountsOut1[0] / 10 ** 18,
        sell: amountsOut2[1] / 10 ** 18,
      };
      const Exchange1results2 = {
        buy: amountsOut5[0] / 10 ** 18,
        sell: amountsOut6[1] / 10 ** 18,
      };

      const Exchange2results = {
        buy: amountsOut3[0] / 10 ** 18,
        sell: amountsOut4[1] / 10 ** 18,
      };
      const Exchange2results2 = {
        buy: amountsOut7[0] / 10 ** 18,
        sell: amountsOut8[1] / 10 ** 18,
      };

      console.log(`exchange1 ${flashloanToken1} Token1/Token2 `);
      console.log(Exchange1results);

      console.log(`exchange2  ${flashloanToken1} Token1/Token2`);
      console.log(Exchange2results);

      console.log(`exchange1 ${flashloanToken2} Token2/Token1`);
      console.log(Exchange1results2);

      console.log(`exchange2 ${flashloanToken2} Token2/Token1 `);
      console.log(Exchange2results2);

      let Exchange2PaybackCalcToken1 =
        (Exchange2results.buy / 0.997) * 10 ** 18;
      let Exchange1PaybackCalcToken1 =
        (Exchange1results.buy / 0.997) * 10 ** 18;
      let Exchange1PaybackCalcToken2 =
        (Exchange1results2.buy / 0.997) * 10 ** 18;
      let Exchange2PaybackCalcToken2 =
        (Exchange2results2.buy / 0.997) * 10 ** 18;

      let repayToken1Exchange2Fee =
        Exchange2PaybackCalcToken1 / 10 ** 18 - Exchange2results.buy;
      let repayToken1Exchange1Fee =
        Exchange1PaybackCalcToken1 / 10 ** 18 - Exchange1results.buy;
      let repayToken2Exchange2Fee =
        Exchange2PaybackCalcToken2 / 10 ** 18 - Exchange2results2.buy;
      let repayToken2Exchange1Fee =
        Exchange1PaybackCalcToken2 / 10 ** 18 - Exchange1results2.buy;

      const gasPrice = await web3.eth.getGasPrice();
      const bnbprice = getbnbprice[1].toString() / 10 ** 8;
      const txCost =
        (330000 * parseInt(gasPrice) * getbnbprice[1].toString()) / 10 ** 18;
      txCost - repayToken1Exchange1Fee;
      const profit1 =
        Exchange1results.sell -
        Exchange2results.buy -
        txCost -
        repayToken1Exchange2Fee;
      const profit2 =
        Exchange2results.sell -
        Exchange1results.buy -
        txCost -
        repayToken1Exchange2Fee;
      const profit3 =
        Exchange2results2.sell -
        Exchange1results2.buy -
        txCost -
        repayToken2Exchange2Fee;
      const profit4 =
        Exchange1results2.sell -
        Exchange2results2.buy -
        txCost -
        repayToken2Exchange1Fee;

      if (profit1 > 0 && profit1 > profit2) {
        console.log("Arb opportunity found!");
        console.log(
          `Flashloan Token2 on exchange1 at ${Exchange1results.buy} `
        );
        console.log(`Sell Token2 on exchange2  at ${Exchange2results.sell} `);
        console.log(`Expected cost of flashswap: ${repayToken1Exchange2Fee}`);
        console.log(`Expected Gas cost: ${txCost}`);
        console.log(`Expected profit: ${profit1} Token1`);

        let tx = flashloan.methods.TokenArbitrage(
          addresses.tokens.Token2, //token1
          addresses.tokens.Token1, //token2
          amountInToken2.toString(), //amount0
          0, //amount1
          addresses.exchange1.factory,
          addresses.exchange2.router,
          Exchange2PaybackCalcToken1.toString()
        );

        const data = tx.encodeABI();
        const txData = {
          from: admin,
          to: flashloan.options.address,
          data,
          gas: "330000",
          gasPrice: gasPrice,
        };
        const receipt = await web3.eth.sendTransaction(txData);
        console.log(`Transaction hash: ${receipt.transactionHash}`);
      }

      if (profit2 > 0 && profit2 > profit1) {
        console.log("Arb opportunity found!");
        console.log(`Buy Token2 from exchange2  at ${Exchange2results.buy} `);
        console.log(`Sell Token2 from exchange1 at ${Exchange1results.sell}`);
        console.log(`Expected cost of flashswap: ${repayToken1Exchange1Fee}`);
        console.log(`Expected Gas cost: ${txCost}`);
        console.log(`Expected profit: ${profit2} Token1`);

        let tx = flashloan.methods.TokenArbitrage(
          addresses.tokens.Token2, //token1
          addresses.tokens.Token1, //token2
          amountInToken2.toString(), //amount0
          0, //amount1
          addresses.exchange2.factory,
          addresses.exchange1.router,
          Exchange1PaybackCalcToken1.toString()
        );

        const data = tx.encodeABI();
        const txData = {
          from: admin,
          to: flashloan.options.address,
          data,
          gas: "330000",
          gasPrice: gasPrice,
        };
        const receipt = await web3.eth.sendTransaction(txData);
        console.log(`Transaction hash: ${receipt.transactionHash}`);
      }

      if (profit3 > 0 && profit3 > profit4) {
        console.log("Arb opportunity found!");
        console.log(
          `Flashloan Token1 on exchange1 at ${Exchange1results2.buy} `
        );
        console.log(`Sell Token1 on exchange2  at ${Exchange2results2.sell} `);
        console.log(`Expected cost of flashswap: ${repayToken2Exchange2Fee}`);
        console.log(`Expected Gas cost: ${txCost}`);
        console.log(`Expected profit: ${profit3} Token2`);

        let tx = flashloan.methods.TokenArbitrage(
          addresses.tokens.Token1, //token1
          addresses.tokens.Token2, //token2
          0, //amount0
          amountInToken1.toString(), //amount1
          addresses.exchange1.factory,
          addresses.exchange2.router,
          Exchange1PaybackCalcToken2.toString()
        );

        const data = tx.encodeABI();
        const txData = {
          from: admin,
          to: flashloan.options.address,
          data,
          gas: "330000",
          gasPrice: gasPrice,
        };
        const receipt = await web3.eth.sendTransaction(txData);
        console.log(`Transaction hash: ${receipt.transactionHash}`);
      }

      if (profit4 > 0 && profit4 > profit3) {
        console.log("Arb opportunity found!");
        console.log(
          `Flashloan Token1 on exchange2  at ${pancakeresults2.buy} `
        );
        console.log(`Sell Token1 on  at exchange1 ${aperesults2.sell} `);
        console.log(`Expected cost of flashswap: ${repayToken2Exchange1Fee}`);
        console.log(`Expected Gas cost: ${txCost}`);
        console.log(`Expected profit: ${profit4} Token2`);

        let tx = flashloan.methods.TokenArbitrage(
          addresses.tokens.Token2,
          addresses.tokens.Token1,
          0, //amount0
          amountInToken1.toString(), //amount1
          addresses.exchange2.factory,
          addresses.exchange1.router,
          Exchange2PaybackCalcToken2.toString()
        );

        const data = tx.encodeABI();
        const txData = {
          from: admin,
          to: flashloan.options.address,
          data,
          gas: "330000",
          gasPrice: gasPrice,
        };
        const receipt = await web3.eth.sendTransaction(txData);
        console.log(`Transaction hash: ${receipt.transactionHash}`);
      }
    })
    .on("error", (error) => {
      console.log(error);
    });
};
init();
