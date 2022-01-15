// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;
pragma abicoder v2;

import './utils/SafeMath.sol';
import './UniswapV2Library.sol';
import './interfaces/IERC20.sol';
import './interfaces/IUniswapV2Pair.sol';
import './interfaces/IUniswapV2Factory.sol';
import './interfaces/IUniswapV2Router01.sol';
import './interfaces/IUniswapV2Router02.sol';
import './interfaces/IUniswapV2Callee.sol';


contract TokenFlashSwap is IUniswapV2Callee {
    address admin;
    constructor() {
    admin = msg.sender; 
    
    
    }

function TokenArbitrage(
    address token0,
    address token1,
    uint amount0,
    address startFactory,
    address endRouterAddress,
    uint repay
  ) external onlyAdmin {
  
    address pairAddress =   IUniswapV2Factory(startFactory).getPair(token0, token1);
    require(pairAddress != address(0), 'This pool does not exist');
    IUniswapV2Pair(pairAddress).swap(
      amount0, 
      0, 
      address(this), 
      abi.encode(endRouterAddress, repay) //not empty bytes param will trigger flashloan
    );
  }
    


function uniswapV2Call(address sender, uint amount0, uint amount1, bytes calldata data) external override {
        address[] memory path = new address[](2);
       ( address endRouter, uint repay) = abi.decode(data, (address, uint));
        
        // scope for token{0,1}, avoids stack too deep errors
        {
        address token0 = IUniswapV2Pair(msg.sender).token0();
        address token1 = IUniswapV2Pair(msg.sender).token1();
        path[0] = amount0 == 0 ? token1 : token0; 
        path[1] = amount0 == 0 ? token0 : token1; 
        }
        
        uint amountToken = amount0== 0 ? amount1 : amount0 ; 
        address token = amount0 == 0 ? path[1] : path[0];

        
            IERC20(token).approve(endRouter, amountToken);
            uint[] memory minOuts = IUniswapV2Router02(endRouter).getAmountsOut(amountToken, path); 
            uint[] memory amountReceived = IUniswapV2Router02(endRouter).swapExactTokensForTokens(amountToken, minOuts[1] , path, address(this), block.timestamp);
            require(amountReceived[1] > repay, "Failed to get enough from swap to repay"); 
            assert(IERC20(token).transfer(msg.sender, repay)); // return tokens to V2 pair
            assert(IERC20(token).transfer(sender, amountReceived[1] - repay)); // keep the rest! (tokens)
    }
        
            
        receive() external payable  {}

        modifier onlyAdmin() {
            require(msg.sender == admin, 'Only Admin has Access');
            _;
        }
    
  }


